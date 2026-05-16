/**
 * Qualtrics connector — surveys and questionnaires.
 *
 * Auth: X-API-TOKEN header with API token.
 * Docs: https://api.qualtrics.com/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function base(dataCenter: string) {
  return `https://${dataCenter.replace(/\.qualtrics\.com.*$/, "")}.qualtrics.com/API/v3`
}

function headers(apiToken: string): Record<string, string> {
  return { "X-API-TOKEN": apiToken, "Content-Type": "application/json" }
}

export async function testConnection(apiToken: string, dataCenter: string): Promise<{ ok: boolean; error?: string; displayName?: string }> {
  try {
    const res = await fetch(`${base(dataCenter)}/whoami`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const data = await res.json() as { result?: { firstName?: string; lastName?: string; email?: string } }
      const name = [data.result?.firstName, data.result?.lastName].filter(Boolean).join(" ") || data.result?.email
      return { ok: true, displayName: name }
    }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid API token or data center" }
    return { ok: false, error: `Qualtrics responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(apiToken: string, dataCenter: string): Promise<ContentItem[]> {
  const res = await fetch(`${base(dataCenter)}/surveys`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Qualtrics API error ${res.status}`)
  const data = await res.json() as {
    result: {
      elements: Array<{ id: string; name: string; isActive: boolean; numberOfQuestions: number }>
      nextPage?: string | null
    }
  }
  return (data.result?.elements ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    state: s.isActive ? "active" : "inactive",
    itemCount: s.numberOfQuestions ?? 0,
  }))
}

export async function fetchContent(apiToken: string, dataCenter: string, surveyId: string): Promise<Record<string, string>> {
  const res = await fetch(`${base(dataCenter)}/survey-definitions/${surveyId}`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Qualtrics API error ${res.status}`)
  const data = await res.json() as {
    result: {
      SurveyName: string
      Questions: Record<string, {
        QuestionText: string
        Choices?: Record<string, { Display: string }>
        Answers?: Record<string, { Display: string }>
      }>
    }
  }
  const result: Record<string, string> = {}
  const survey = data.result
  if (survey.SurveyName) result["survey_name"] = survey.SurveyName
  Object.entries(survey.Questions ?? {}).forEach(([qId, q]) => {
    const text = q.QuestionText?.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim()
    if (text) result[`q_${qId}`] = text
    // Answer choices (single/multi-choice questions)
    Object.entries(q.Choices ?? {}).forEach(([cId, choice]) => {
      if (choice.Display?.trim()) result[`q_${qId}_c_${cId}`] = choice.Display.trim()
    })
    // Matrix row labels / scale answers
    Object.entries(q.Answers ?? {}).forEach(([aId, answer]) => {
      if (answer.Display?.trim()) result[`q_${qId}_a_${aId}`] = answer.Display.trim()
    })
  })
  return result
}

export async function pushTranslation(
  apiToken: string, dataCenter: string,
  surveyId: string, locale: string, translations: Record<string, string>
): Promise<void> {
  // Rebuild the Qualtrics survey translation object from our internal key format.
  //
  // Qualtrics PUT /survey-definitions/{id}/languages/{locale} expects:
  // {
  //   "SurveyEntry": { "SurveyName": "..." },
  //   "QID1": {
  //     "QuestionText": "...",
  //     "Choices": { "1": "...", "2": "..." },
  //     "Answers": { "1": "..." }
  //   },
  //   ...
  // }
  //
  // Our internal keys:
  //   "survey_name"           → SurveyEntry.SurveyName
  //   "q_{qId}"               → {qId}.QuestionText
  //   "q_{qId}_c_{cId}"       → {qId}.Choices.{cId}
  //   "q_{qId}_a_{aId}"       → {qId}.Answers.{aId}

  type QEntry = {
    QuestionText?: string
    Choices?: Record<string, string>
    Answers?: Record<string, string>
  }
  const body: Record<string, unknown> = {}

  Object.entries(translations).forEach(([key, val]) => {
    if (key === "survey_name") {
      body.SurveyEntry = { SurveyName: val }
      return
    }

    // Matrix answer: q_{qId}_a_{aId}
    const answerMatch = key.match(/^q_([A-Za-z0-9]+)_a_([A-Za-z0-9]+)$/)
    if (answerMatch) {
      const [, qId, aId] = answerMatch
      const entry = (body[qId] ?? {}) as QEntry
      entry.Answers = entry.Answers ?? {}
      entry.Answers[aId] = val
      body[qId] = entry
      return
    }

    // Choice: q_{qId}_c_{cId}
    const choiceMatch = key.match(/^q_([A-Za-z0-9]+)_c_([A-Za-z0-9]+)$/)
    if (choiceMatch) {
      const [, qId, cId] = choiceMatch
      const entry = (body[qId] ?? {}) as QEntry
      entry.Choices = entry.Choices ?? {}
      entry.Choices[cId] = val
      body[qId] = entry
      return
    }

    // Question text: q_{qId}
    const qMatch = key.match(/^q_([A-Za-z0-9]+)$/)
    if (qMatch) {
      const [, qId] = qMatch
      const entry = (body[qId] ?? {}) as QEntry
      entry.QuestionText = val
      body[qId] = entry
    }
  })

  const res = await fetch(`${base(dataCenter)}/survey-definitions/${surveyId}/languages/${locale}`, {
    method: "PUT",
    headers: headers(apiToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    let detail = msg.slice(0, 300)
    try {
      const parsed = JSON.parse(msg) as { meta?: { error?: { errorMessage?: string } } }
      if (parsed.meta?.error?.errorMessage) detail = parsed.meta.error.errorMessage
    } catch { /* keep raw */ }
    throw new Error(`Qualtrics push failed (${res.status}): ${detail}`)
  }
}
