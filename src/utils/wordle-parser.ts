export interface WordleData {
  gameNumber: number
  attempts: number | null // null for failed attempts
  failed: boolean
  date: string
}

export const parseWordleMessage = (message: string): WordleData | null => {
  // Match successful attempts: "Wordle 1,495 3/6"
  const successRegex = /Wordle\s+([0-9,]+)\s+(\d+)\/6/i
  const successMatch = message.match(successRegex)
  
  if (successMatch) {
    const gameNumber = parseInt(successMatch[1].replace(/,/g, ''))
    const attempts = parseInt(successMatch[2])
    const date = new Date().toISOString().split('T')[0]
    
    return {
      gameNumber,
      attempts,
      failed: false,
      date
    }
  }
  
  // Match failed attempts: "Wordle 1,495 X/6" or "Wordle 1,495 */6"
  const failRegex = /Wordle\s+([0-9,]+)\s+[X*]\/6/i
  const failMatch = message.match(failRegex)
  
  if (failMatch) {
    const gameNumber = parseInt(failMatch[1].replace(/,/g, ''))
    const date = new Date().toISOString().split('T')[0]
    
    return {
      gameNumber,
      attempts: null,
      failed: true,
      date
    }
  }
  
  return null
}