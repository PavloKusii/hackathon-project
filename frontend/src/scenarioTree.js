export const LETTERS = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split("");

export function optionLetter(index) {
  return LETTERS[index] || String(index + 1);
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
  if (!node) return 0;
  return 1 + (node.options || []).reduce((sum, option) => sum + countNodes(option.next), 0);
}

export function replaceNode(node, id, nextNode) {
  if (!node) return node;
  if (node.id === id) return nextNode;
  return {
    ...node,
    options: (node.options || []).map((option) => ({
      ...option,
      next: option.next ? replaceNode(option.next, id, nextNode) : null
    }))
  };
}

export function findNode(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  for (const option of node.options || []) {
    const found = findNode(option.next, id);
    if (found) return found;
  }
  return null;
}

export function formTreeFromApi(node) {
  if (!node) return null;
  return {
    id: node.id || "",
    label: node.label || node.id || "",
    prompt: node.prompt || "",
    options: (node.options || []).map((option, index) => ({
      id: option.id || String.fromCharCode(97 + index),
      title: option.title || "",
      text: option.text || "",
      badges: Array.isArray(option.badges) ? option.badges.join(", ") : (option.badges || ""),
      analysis: option.analysis || "",
      deferred: option.deferred || "",
      legal: option.legal || "",
      legalTitle: option.legalRefs?.[0]?.title || option.legalTitle || "",
      legalHref: option.legalRefs?.[0]?.href || option.legalHref || "",
      integrity: option.deltas?.integrity || 0,
      trust: option.deltas?.trust || 0,
      effectiveness: option.deltas?.effectiveness || 0,
      next: formTreeFromApi(option.next)
    }))
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
        integrity: Number(option.integrity) || 0,
        trust: Number(option.trust) || 0,
        effectiveness: Number(option.effectiveness) || 0
      },
      next: apiTreeFromForm(option.next)
    }))
  };
}
