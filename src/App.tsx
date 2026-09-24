import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Screen = 'start' | 'quiz' | 'results'

type Question = {
  first: number
  second: number
  operation: Operation
  answer: number
}

type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division'

type QuizConfig = {
  questionCount: number
  minNumber: number
  maxNumber: number
  secondsPerQuestion: number
  operations: Operation[]
}

type Results = {
  attempted: number
  correct: number
  wrong: number
  timedOut: number
}

type MissedQuestion = {
  first: number
  second: number
  operation: Operation
  answer: number
  submittedAnswer: string | null
  outcome: 'wrong' | 'timedOut'
}

type DailyHistory = {
  date: string
  attempts: number
  scores: number[]
  missedQuestions: MissedQuestion[]
}

const DEFAULT_CONFIG: QuizConfig = {
  questionCount: 50,
  minNumber: 1,
  maxNumber: 9,
  secondsPerQuestion: 5,
  operations: ['multiplication'],
}

const CONFIG_STORAGE_KEY = 'math-sparks-config'
const HISTORY_STORAGE_KEY = 'math-sparks-history'

const operationSymbols: Record<Operation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
}

const operationLabels: Record<Operation, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
}

const operationOptions: Operation[] = ['addition', 'subtraction', 'multiplication', 'division']

const randomNumber = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const makeQuestion = (config: QuizConfig): Question => {
  const operation = config.operations[randomNumber(0, config.operations.length - 1)]
  let first = randomNumber(config.minNumber, config.maxNumber)
  let second = randomNumber(config.minNumber, config.maxNumber)

  if (operation === 'subtraction' && first < second) {
    ;[first, second] = [second, first]
  }

  if (operation === 'division') {
    const divisibleNumbers = Array.from(
      { length: config.maxNumber - config.minNumber + 1 },
      (_, index) => config.minNumber + index,
    ).filter((number) => number % second === 0)
    first = divisibleNumbers.length
      ? divisibleNumbers[randomNumber(0, divisibleNumbers.length - 1)]
      : second
  }

  const answer = operation === 'addition'
    ? first + second
    : operation === 'subtraction'
      ? first - second
      : operation === 'multiplication'
        ? first * second
        : first / second

  return { first, second, operation, answer }
}

const loadConfig = (): QuizConfig => {
  try {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!savedConfig) return DEFAULT_CONFIG
    const parsedConfig = JSON.parse(savedConfig) as Partial<QuizConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsedConfig,
      operations: parsedConfig.operations?.length ? parsedConfig.operations : DEFAULT_CONFIG.operations,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

const dateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadHistory = (): DailyHistory[] => {
  try {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!savedHistory) return []
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - 6)
    const cutoffKey = dateKey(cutoff)
    const parsedHistory = JSON.parse(savedHistory) as DailyHistory[]
    return parsedHistory.filter((day) => day.date >= cutoffKey).sort((first, second) => second.date.localeCompare(first.date))
  } catch {
    return []
  }
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(`${date}T12:00:00`))

const emptyResults: Results = {
  attempted: 0,
  correct: 0,
  wrong: 0,
  timedOut: 0,
}

function App() {
  const [config, setConfig] = useState<QuizConfig>(loadConfig)
  const [screen, setScreen] = useState<Screen>('start')
  const [question, setQuestion] = useState<Question>(() => makeQuestion(loadConfig()))
  const [answer, setAnswer] = useState('')
  const [questionNumber, setQuestionNumber] = useState(1)
  const [totalQuestions, setTotalQuestions] = useState(config.questionCount)
  const [secondsLeft, setSecondsLeft] = useState(config.secondsPerQuestion)
  const [revealAnswer, setRevealAnswer] = useState<number | null>(null)
  const [submitLocked, setSubmitLocked] = useState(true)
  const [results, setResults] = useState<Results>(emptyResults)
  const [missedQuestions, setMissedQuestions] = useState<MissedQuestion[]>([])
  const [history, setHistory] = useState<DailyHistory[]>(loadHistory)
  const [selectedHistory, setSelectedHistory] = useState<DailyHistory | null>(null)

  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  }, [config])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const updateConfig = <K extends keyof QuizConfig>(key: K, value: QuizConfig[K]) => {
    setConfig((currentConfig) => ({ ...currentConfig, [key]: value }))
  }

  const beginQuiz = () => {
    setQuestion(makeQuestion(config))
    setQuestionNumber(1)
    setTotalQuestions(config.questionCount)
    setSecondsLeft(config.secondsPerQuestion)
    setAnswer('')
    setRevealAnswer(null)
    setSubmitLocked(true)
    setResults(emptyResults)
    setMissedQuestions([])
    setScreen('quiz')
  }

  const saveCompletedQuiz = (completedResults: Results, completedMissedQuestions: MissedQuestion[]) => {
    const completedScore = completedResults.attempted
      ? Math.round((completedResults.correct / completedResults.attempted) * 100)
      : 0
    const today = dateKey()

    setHistory((currentHistory) => {
      const todayEntry = currentHistory.find((day) => day.date === today)
      const updatedEntry: DailyHistory = todayEntry
        ? {
            ...todayEntry,
            attempts: todayEntry.attempts + 1,
            scores: [...todayEntry.scores, completedScore],
            missedQuestions: [...todayEntry.missedQuestions, ...completedMissedQuestions],
          }
        : {
            date: today,
            attempts: 1,
            scores: [completedScore],
            missedQuestions: completedMissedQuestions,
          }

      return [updatedEntry, ...currentHistory.filter((day) => day.date !== today)]
    })
  }

  const finishQuestion = useCallback((outcome: 'correct' | 'wrong' | 'timedOut') => {
    const nextTotalQuestions = totalQuestions + (outcome === 'wrong' ? 1 : 0)
    const nextResults = {
      ...results,
      attempted: results.attempted + 1,
      [outcome]: results[outcome] + 1,
    }

    setResults(nextResults)
    setTotalQuestions(nextTotalQuestions)

    if (outcome === 'wrong' || outcome === 'timedOut') {
      setMissedQuestions((questions) => [...questions, {
        first: question.first,
        second: question.second,
        operation: question.operation,
        answer: question.answer,
        submittedAnswer: outcome === 'wrong' ? answer : null,
        outcome,
      }])
      setRevealAnswer(question.answer)
      return
    }

    if (questionNumber >= nextTotalQuestions) {
      saveCompletedQuiz(nextResults, missedQuestions)
      setScreen('results')
      return
    }

    setQuestion(makeQuestion(config))
    setQuestionNumber((number) => number + 1)
    setSecondsLeft(config.secondsPerQuestion)
    setAnswer('')
    setSubmitLocked(true)
  }, [answer, config, missedQuestions, question, questionNumber, results, totalQuestions])

  const advanceAfterReveal = useCallback(() => {
    if (questionNumber >= totalQuestions) {
      saveCompletedQuiz(results, missedQuestions)
      setRevealAnswer(null)
      setScreen('results')
      return
    }

    setQuestion(makeQuestion(config))
    setQuestionNumber((number) => number + 1)
    setSecondsLeft(config.secondsPerQuestion)
    setAnswer('')
    setRevealAnswer(null)
    setSubmitLocked(true)
  }, [config, missedQuestions, questionNumber, results, totalQuestions])

  useEffect(() => {
    if (screen !== 'quiz' || !submitLocked) return
    const lockTimer = window.setTimeout(() => setSubmitLocked(false), 1000)
    return () => window.clearTimeout(lockTimer)
  }, [screen, submitLocked])

  useEffect(() => {
    if (screen !== 'quiz' || revealAnswer !== null) return

    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          finishQuestion('timedOut')
          return config.secondsPerQuestion
        }
        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [config.secondsPerQuestion, finishQuestion, revealAnswer, screen])

  useEffect(() => {
    if (screen !== 'quiz' || revealAnswer === null) return
    const revealTimer = window.setTimeout(advanceAfterReveal, 3000)
    return () => window.clearTimeout(revealTimer)
  }, [advanceAfterReveal, revealAnswer, screen])

  const submitAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitLocked) return
    const numericAnswer = Number(answer)
    finishQuestion(numericAnswer === question.answer ? 'correct' : 'wrong')
  }

  const score = results.attempted
    ? Math.round((results.correct / results.attempted) * 100)
    : 0

  if (screen === 'results') {
    return (
      <main className="app-shell results-shell">
        <div className="top-mark" aria-hidden="true">× ÷ + −</div>
        <section className="results-panel" aria-labelledby="results-title">
          <p className="eyebrow">Practice complete</p>
          <h1 id="results-title">You did it!</h1>
          <div className="score-circle" aria-label={`Score ${score} percent`}>
            <strong>{score}%</strong>
            <span>score</span>
          </div>
          <div className="stats-grid">
            <div className="stat stat-blue"><strong>{results.attempted}</strong><span>Attempted</span></div>
            <div className="stat stat-green"><strong>{results.correct}</strong><span>Correct</span></div>
            <div className="stat stat-orange"><strong>{results.wrong}</strong><span>Wrong</span></div>
            <div className="stat stat-pink"><strong>{results.timedOut}</strong><span>Timed out</span></div>
          </div>
          <button className="primary-button" type="button" onClick={() => setScreen('start')}>Practice again <span aria-hidden="true">→</span></button>
        </section>
        {missedQuestions.length > 0 && <section className="missed-panel" aria-labelledby="missed-title">
          <h2 id="missed-title">Review your missed questions</h2>
          <div className="missed-list">
            {missedQuestions.map((missedQuestion, index) => <div className="missed-question" key={`${missedQuestion.first}-${missedQuestion.second}-${index}`}>
              <strong>{missedQuestion.first} {operationSymbols[missedQuestion.operation]} {missedQuestion.second}</strong>
              <span>Answer: {missedQuestion.answer}</span>
              <em>{missedQuestion.outcome === 'timedOut' ? 'Timed out' : `You answered ${missedQuestion.submittedAnswer}`}</em>
            </div>)}
          </div>
        </section>}
        <p className="footer-note">Every question makes your brain stronger.</p>
      </main>
    )
  }

  if (screen === 'quiz') {
    const progress = ((questionNumber - 1) / totalQuestions) * 100

    return (
      <main className="app-shell quiz-shell">
        <header className="quiz-header">
          <div className="brand-mark"><span aria-hidden="true">✦</span> Math sparks</div>
          <div className="question-count">Question <strong>{questionNumber}</strong> <span>of {totalQuestions}</span></div>
        </header>
        <div className="progress-track" aria-label={`${questionNumber} of ${totalQuestions} questions`}><span style={{ width: `${progress}%` }} /></div>
        <div className="time-track" aria-label={`${secondsLeft} seconds remaining`}><span style={{ width: `${(secondsLeft / config.secondsPerQuestion) * 100}%` }} /></div>
        <section className="quiz-card" aria-labelledby="question-title">
          <div className={`timer ${secondsLeft === 1 ? 'timer-alert' : ''}`}><span aria-hidden="true">◷</span> {secondsLeft}s</div>
          <div className="quiz-content">
            <div className="question-side">
              <p className="eyebrow">Solve it!</p>
              <h1 id="question-title">What is {question.first} {operationSymbols[question.operation]} {question.second}?</h1>
              {revealAnswer !== null && <p className="answer-reveal">The answer is <strong>{revealAnswer}</strong></p>}
              {revealAnswer === null && <form onSubmit={submitAnswer}>
                <label htmlFor="answer">Your answer</label>
                <input
                  id="answer"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  aria-label="Your answer"
                />
                <button className="primary-button" type="submit" disabled={submitLocked}>Check answer <span aria-hidden="true">→</span></button>
              </form>}
              <p className="hint">Quick thinking, kind brain.</p>
            </div>
            {revealAnswer === null && <div className="number-pad" aria-label="Number pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => <button key={number} autoFocus={number === 1} type="button" onClick={() => setAnswer((current) => `${current}${number}`)}>{number}</button>)}
              <button type="button" className="number-pad-clear" onClick={() => setAnswer('')}>Clear</button>
              <button type="button" onClick={() => setAnswer((current) => `${current}0`)}>0</button>
              <button type="button" className="number-pad-delete" onClick={() => setAnswer((current) => current.slice(0, -1))}>⌫</button>
            </div>}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell start-shell">
      <div className="confetti confetti-one" aria-hidden="true">✦</div>
      <div className="confetti confetti-two" aria-hidden="true">●</div>
      <div className="confetti confetti-three" aria-hidden="true">△</div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="brand-mark"><span aria-hidden="true">✦</span> Math sparks</div>
        <div className="spark-icon" aria-hidden="true">×</div>
        <p className="eyebrow">You got this</p>
        <section className="history-panel" aria-labelledby="welcome-title">
          <h3 id="welcome-title">High Scores</h3>
          {history.length > 0 ? <table className="history-table">
            <thead><tr><th scope="col">Date</th><th scope="col">Attempts</th><th scope="col">Min score</th><th scope="col">Top score</th><th scope="col">Average score</th></tr></thead>
            <tbody>{history.map((day) => {
              const minScore = Math.min(...day.scores)
              const topScore = Math.max(...day.scores)
              const averageScore = Math.round(day.scores.reduce((total, current) => total + current, 0) / day.scores.length)
              return <tr key={day.date}>
                <td>{formatDate(day.date)}</td>
                <td>{day.attempts}</td>
                <td>{minScore}%</td>
                <td>{topScore}%</td>
                <td><button type="button" className="score-link" onClick={() => setSelectedHistory(day)}>{averageScore}%</button></td>
              </tr>
            })}</tbody>
          </table> : <p className="empty-history">Complete a practice round to see your scores here.</p>}
        </section>
        <div className="settings-panel">
          <div className="settings-grid">
            <label>Questions<input type="number" max="500" value={config.questionCount} onChange={(event) => updateConfig('questionCount', Math.max(1, Number(event.target.value)))} /></label>
            <label>Lowest number<input type="number" max={config.maxNumber} value={config.minNumber} onChange={(event) => updateConfig('minNumber', Math.min(config.maxNumber, Math.max(1, Number(event.target.value))))} /></label>
            <label>Highest number<input type="number" min={config.minNumber} max="100" value={config.maxNumber} onChange={(event) => updateConfig('maxNumber', Math.max(config.minNumber, Number(event.target.value)))} /></label>
            <label>Seconds each<input type="number"  max="60" value={config.secondsPerQuestion} onChange={(event) => updateConfig('secondsPerQuestion', Math.max(1, Number(event.target.value)))} /></label>
          </div>
          <fieldset>
            <legend>Operations</legend>
            <div className="operation-options">{operationOptions.map((operation) => <label key={operation}><input type="checkbox" checked={config.operations.includes(operation)} onChange={(event) => {
              const operations = event.target.checked ? [...config.operations, operation] : config.operations.filter((item) => item !== operation)
              if (operations.length) updateConfig('operations', operations)
            }} /> <span>{operationSymbols[operation]}</span>{operationLabels[operation]}</label>)}</div>
          </fieldset>
        </div>
        <button className="primary-button start-button" type="button" onClick={beginQuiz}>Start practice <span aria-hidden="true">→</span></button>
      </section>
      {selectedHistory && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedHistory(null)}>
        <section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" aria-label="Close score details" onClick={() => setSelectedHistory(null)}>×</button>
          <p className="eyebrow">{formatDate(selectedHistory.date)}</p>
          <h2 id="history-modal-title">Missed questions</h2>
          {selectedHistory.missedQuestions.length > 0 ? <div className="missed-list">
            {selectedHistory.missedQuestions.map((missedQuestion, index) => <div className="missed-question" key={`${missedQuestion.first}-${missedQuestion.second}-${index}`}>
              <strong>{missedQuestion.first} {operationSymbols[missedQuestion.operation]} {missedQuestion.second}</strong>
              <span>Answer: {missedQuestion.answer}</span>
              <em>{missedQuestion.outcome === 'timedOut' ? 'Timed out' : `You answered ${missedQuestion.submittedAnswer}`}</em>
            </div>)}
          </div> : <p className="empty-history">Perfect day. No missed questions.</p>}
        </section>
      </div>}
    </main>
  )
}

export default App
