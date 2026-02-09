// AI Services: Claude for text generation, OpenAI for TTS

// --- Claude API (Anthropic) ---
export async function generateSpellingContent(words, anthropicKey) {
  const wordList = words.join(', ');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are helping an 8-year-old British child practise their weekly spelling words. The words are: ${wordList}

Please generate:
1. For EACH word, a silly and funny sentence using British English words and idioms. The sentences should make a child laugh — think daft scenarios, talking animals, silly mishaps, funny British expressions. Keep them short and punchy.
2. A short funny story (about 150-200 words) that uses ALL of the spelling words. It should be silly, age-appropriate, and entertaining. Use British English throughout (colour not color, mum not mom, etc.).

IMPORTANT: Respond ONLY with valid JSON in this exact format, no markdown backticks:
{
  "sentences": {
    "word1": "funny sentence here",
    "word2": "funny sentence here"
  },
  "story": "the complete funny story here"
}`
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  
  // Parse JSON, handling potential markdown fences
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// --- Claude Vision (for photo OCR) ---
export async function extractWordsFromPhoto(base64Image, anthropicKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image
            }
          },
          {
            type: 'text',
            text: `This is a photo of a child's weekly spelling list from a British school. Please extract all the spelling words from this image. Return ONLY a JSON array of the words, nothing else. Example: ["word1", "word2", "word3"]. No markdown backticks.`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude Vision API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// --- OpenAI TTS ---
export async function generateSpeech(text, openaiKey, voice = 'fable') {
  // Try the newer gpt-4o-mini-tts model first (supports instructions for British accent)
  // Fall back to tts-1 if it fails
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: voice,
        instructions: 'Speak with a warm, friendly British English accent. You are reading spelling words and funny sentences to an 8-year-old child. Be clear, cheerful, and slightly playful.',
        response_format: 'mp3'
      })
    });
  } catch (e) {
    // Fall back to tts-1 if gpt-4o-mini-tts fails
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    });
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI TTS error: ${response.status} - ${err}`);
  }

  return await response.blob();
}

// Generate all audio for a spelling list and return blob URLs
export async function generateAllAudio(words, sentences, story, openaiKey) {
  const audioData = {};
  
  // For each word: generate "The word is: [word]", then the sentence, then "[word]" again
  for (const word of words) {
    // Word announcement
    const wordBlob = await generateSpeech(
      `The word is: ${word}.`,
      openaiKey
    );
    audioData[`word_${word}`] = wordBlob;
    
    // Sentence
    const sentenceBlob = await generateSpeech(
      sentences[word] || `${word} is this week's spelling word.`,
      openaiKey
    );
    audioData[`sentence_${word}`] = sentenceBlob;
    
    // Word repeat
    const repeatBlob = await generateSpeech(
      `${word}.`,
      openaiKey
    );
    audioData[`repeat_${word}`] = repeatBlob;
    
    // Spelling out letter by letter
    const letters = word.split('').join(', ');
    const spellingBlob = await generateSpeech(
      `${word} is spelt: ${letters}. ${word}.`,
      openaiKey
    );
    audioData[`spelling_${word}`] = spellingBlob;
  }
  
  // Story audio
  const storyBlob = await generateSpeech(story, openaiKey);
  audioData['story'] = storyBlob;
  
  return audioData;
}
