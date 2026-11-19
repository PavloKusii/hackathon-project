export const LETTERS = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split("");

export function optionLetter(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = LETTERS[value % LETTERS.length] + label;
    value = Math.floor(value / LETTERS.length);
  }
  return label;
}

function randomId(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export function blankOption(id) {
  return {
    id,
    title: "",
    text: "",
    badges: "",
    analysis: "",
    deferred: "",
    legal: "",
    legalTitle: "",
    legalHref: "",
    integrity: 0,
    trust: 0,
    effectiveness: 0,
    next: null
  };
}

export function createNode(label) {
  return {
    id: randomId("n"),
    label,
    prompt: "",
    options: [blankOption(randomId("o")), blankOption(randomId("o"))]
  };
}

export function createLinkedOption(parentLabel, index) {
  const option = blankOption(randomId("o"));
  option.next = createNode(`${parentLabel}${optionLetter(index)}`);
  return option;
}

export function createOption() {
  return blankOption(randomId("o"));
}

export function starterSize(depth, optionCount) {
  const count = Math.max(2, Math.min(8, Number(optionCount) || 2));
  const levels = Math.max(1, Math.min(8, Number(depth) || 1));
  let nodes = 0;
  let width = 1;
  for (let level = 0; level < levels; level += 1) {
    nodes += width;
    width *= count;
  }
  return nodes;
}

export function buildTree(depth, optionCount, label = "1") {
  const count = Math.max(2, Math.min(8, Number(optionCount) || 2));
  const levels = Math.max(1, Math.min(8, Number(depth) || 1));
  return {
    id: `n-${label}`,
    label,
    prompt: "",
    options: Array.from({ length: count }, (_, index) => {
      const option = blankOption(String.fromCharCode(97 + index));
      const letter = optionLetter(index);
      option.next = levels > 1 ? buildTree(levels - 1, count, `${label}${letter}`) : null;
      return option;
    })
  };
}

export function countNodes(node) {
  const seen = new Set();
  function count(current) {
    if (!current || seen.has(current.id)) return 0;
    seen.add(current.id);
    return 1 + (current.options || []).reduce((sum, option) => sum + count(option.next), 0);
  }
  return count(node);
}

export function replaceNode(node, id, nextNode) {
  const replaced = new Map();
  function replace(current) {
    if (!current) return current;
    if (current.id === id) return nextNode;
    if (replaced.has(current.id)) return replaced.get(current.id);
    const result = { ...current, options: [] };
    replaced.set(current.id, result);
    result.options = (current.options || []).map((option) => ({
      ...option,
      next: option.next ? replace(option.next) : null
    }));
    return result;
  }
  return replace(node);
}

export function findNode(node, id) {
  const visited = new Set();
  function find(current) {
    if (!current || visited.has(current.id)) return null;
    if (current.id === id) return current;
    visited.add(current.id);
    for (const option of current.options || []) {
      const found = find(option.next);
      if (found) return found;
    }
    return null;
  }
  return id ? find(node) : null;
}

export function removeNode(node, id) {
  const removed = new Map();
  function remove(current) {
    if (!current || current.id === id) return null;
    if (removed.has(current.id)) return removed.get(current.id);
    const result = { ...current, options: [] };
    removed.set(current.id, result);
    result.options = (current.options || []).map((option) => ({
      ...option,
      next: remove(option.next)
    }));
    return result;
  }
  return remove(node);
}

export function formTreeFromApi(node, label = "1", usedIds = new Set()) {
  if (!node || typeof node !== "object") return null;
  const baseId = typeof node.id === "string" && node.id ? node.id : `n-${label}`;
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
  usedIds.add(id);
  return {
    id,
    label: typeof node.label === "string" && node.label ? node.label : label,
    prompt: typeof node.prompt === "string" ? node.prompt : "",
    options: (Array.isArray(node.options) ? node.options : []).map((rawOption, index) => {
      const option = rawOption && typeof rawOption === "object" ? rawOption : {};
      const optionDeltas = option.deltas && typeof option.deltas === "object" ? option.deltas : {};
      const legalRef = Array.isArray(option.legalRefs) ? option.legalRefs[0] : null;
      const letter = LETTERS[index] || String(index + 1);
      const badges = Array.isArray(option.badges)
        ? option.badges.filter((badge) => typeof badge === "string").join(", ")
        : (typeof option.badges === "string" ? option.badges : "");
      const delta = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(-40, Math.min(0, number)) : 0;
      };
      return {
        id: typeof option.id === "string" && option.id ? option.id : `option-${index + 1}`,
        title: typeof option.title === "string" ? option.title : "",
        text: typeof option.text === "string" ? option.text : "",
        badges,
        analysis: typeof option.analysis === "string" ? option.analysis : "",
        deferred: typeof option.deferred === "string" ? option.deferred : "",
        legal: typeof option.legal === "string" ? option.legal : "",
        legalTitle: typeof legalRef?.title === "string" ? legalRef.title : (typeof option.legalTitle === "string" ? option.legalTitle : ""),
        legalHref: typeof legalRef?.href === "string" ? legalRef.href : (typeof option.legalHref === "string" ? option.legalHref : ""),
        integrity: delta(optionDeltas.integrity ?? option.integrity),
        trust: delta(optionDeltas.trust ?? option.trust),
        effectiveness: delta(optionDeltas.effectiveness ?? option.effectiveness),
        next: formTreeFromApi(option.next, `${label}${letter}`, usedIds)
      };
    })
  };
}

export function apiTreeFromForm(node) {
  if (!node) return null;
  return {
    id: node.id,
    label: node.label,
    prompt: node.prompt,
    options: (node.options || []).map((option) => ({
      id: option.id,
      title: option.title,
      text: option.text,
      badges: option.badges,
      analysis: option.analysis,
      deferred: option.deferred,
      legal: option.legal,
      legalTitle: option.legalTitle,
      legalHref: option.legalHref,
      deltas: {
        integrity: Math.min(0, Number(option.integrity) || 0),
        trust: Math.min(0, Number(option.trust) || 0),
        effectiveness: Math.min(0, Number(option.effectiveness) || 0)
      },
      next: apiTreeFromForm(option.next)
    }))
  };
}
