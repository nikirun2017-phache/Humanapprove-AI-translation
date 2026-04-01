import { XMLParser, XMLBuilder } from "fast-xml-parser"

interface UnitRevision {
  xliffUnitId: string
  revisedTarget: string | null
  targetText: string
  status: string
}

/**
 * Merges reviewer-approved/revised targets back into the original XLIFF XML.
 * Preserves all original attributes, inline tags, and structure.
 */
export function exportRevisedXliff(
  originalXml: string,
  revisions: UnitRevision[]
): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseTagValue: false,
    trimValues: false,
    cdataPropName: "__cdata",
    preserveOrder: true,
    // XXE prevention
    processEntities: false,
  })

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
    preserveOrder: true,
    format: true,
    indentBy: "  ",
  })

  const revisionMap = new Map<string, string>()
  for (const r of revisions) {
    const finalTarget = r.revisedTarget !== null ? r.revisedTarget : r.targetText
    revisionMap.set(r.xliffUnitId, finalTarget)
  }

  // Parse preserving order to safely mutate target text
  const parsed = parser.parse(originalXml)

  // In preserveOrder:true mode, each node is { "tagName": [...children], ":@": { "@_attr": val } }
  // So obj["trans-unit"] gives the CHILDREN of that trans-unit, and obj[":@"] gives its attributes.
  function mutateTargets(nodes: unknown[]): void {
    for (const node of nodes) {
      const obj = node as Record<string, unknown>

      // If this node IS a trans-unit or unit element, obj[":@"]["@_id"] holds its id
      for (const tagName of ["trans-unit", "unit"]) {
        if (obj[tagName] !== undefined) {
          const attrs = obj[":@"] as Record<string, unknown> | undefined
          const id = attrs?.["@_id"] as string | undefined

          if (id && revisionMap.has(id)) {
            const newTarget = revisionMap.get(id)!
            if (Array.isArray(obj[tagName])) {
              updateTargetInChildren(obj[tagName] as unknown[], newTarget)
            }
          }

          // Recurse into this unit's children (handles nested groups)
          if (Array.isArray(obj[tagName])) {
            mutateTargets(obj[tagName] as unknown[])
          }
        }
      }

      // Recurse into container elements
      for (const key of ["body", "file", "group", "xliff"]) {
        if (obj[key] !== undefined && Array.isArray(obj[key])) {
          mutateTargets(obj[key] as unknown[])
        }
      }
    }
  }

  // Children of a trans-unit are nodes like { "source": [...] } or { "target": [...] }
  function updateTargetInChildren(children: unknown[], newText: string): void {
    for (const child of children) {
      const c = child as Record<string, unknown>

      if (c["target"] !== undefined) {
        // Replace target's children with plain text node
        c["target"] = [{ "#text": newText }]
        return
      }

      // XLIFF 2.0: <segment> contains <target>
      if (c["segment"] !== undefined && Array.isArray(c["segment"])) {
        updateTargetInChildren(c["segment"] as unknown[], newText)
      }
    }
  }

  mutateTargets(parsed)

  const xml = builder.build(parsed)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
}
