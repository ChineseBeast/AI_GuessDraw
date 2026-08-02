/** AI 猜测结果 */
export interface AIGuess {
  word: string;
  confidence: number;
}

/** AI 识别响应 */
export interface AIRecognizeResponse {
  guesses: AIGuess[];
  isCorrect: boolean;
  matchedGuess?: AIGuess;
  processingTime: number;
}
