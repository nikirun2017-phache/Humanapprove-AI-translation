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

export async function testConnection(apiToken: string, dataCenter: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(dataCenter)}/whoami`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
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
  const data = await res.json() as { result: { elements: Array<{ id: string; name: string; isActive: boolean; numberOfQuestions: number }> } }
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
      Questions: Record<string, { QuestionText: string; Choices?: Record<string, { Display: string }> }>
    }
  }
  const result: Record<string, string> = {}
  const survey = data.result
  if (survey.SurveyName) result["survey_name"] = survey.SurveyName
  Object.entries(survey.Questions ?? {}).forEach(([qId, q]) => {
    const text = q.QuestionText?.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
    if (text) result[`q_${qId}`] = text
    Object.entries(q.Choices ?? {}).forEach(([cId, choice]) => {
      if (choice.Display) result[`q_${qId}_c_${cId}`] = choice.Display
    })
  })
  return result
}

export async function pushTranslation(
  apiToken: string, dataCenter: string,
  surveyId: string, locale: string, translations: Record<string, string>
): Promise<void> {
  // Map translations back into Qualtrics survey translation format
  const languageTranslation: Record<string, string> = {}
  Object.entries(translations).forEach(([key, val]) => {
    languageTranslation[key] = val
  })

  const res = await fetch(`${base(dataCenter)}/survey-definitions/${surveyId}/languages/${locale}`, {
    method: "PUT",
    headers: headers(apiToken),
    body: JSON.stringify(languageTranslation),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Qualtrics push translation failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
