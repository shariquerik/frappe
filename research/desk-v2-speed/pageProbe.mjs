// In-page probe: records every animation frame that changed the DOM, with the visible content and
// skeletons in it. Serialized into the page, so it may not close over anything.

export function installProbe({ skeletons, content }) {
  const probe = { start: 0, frames: [], dirty: false, lastChange: 0 };
  window.__probe = probe;

  const visible = (selector) =>
    [...document.querySelectorAll(selector)].filter((element) =>
      element.checkVisibility()
    ).length;
  const snapshot = () => ({
    skeletons: visible(skeletons),
    content: Object.fromEntries(
      Object.entries(content).map(([page, selector]) => [
        page,
        visible(selector),
      ])
    ),
  });

  probe.reset = () => {
    probe.start = performance.now();
    probe.frames = [];
    probe.lastChange = probe.start;
  };

  probe.read = (page) => {
    const now = snapshot();
    const fcp = performance
      .getEntriesByType("paint")
      .find((entry) => entry.name === "first-contentful-paint");
    return {
      quietMs: performance.now() - probe.lastChange,
      content: now.content[page],
      skeletons: now.skeletons,
      fcp: fcp ? fcp.startTime : null,
      frames: probe.frames.map((frame) => ({
        t: frame.t - probe.start,
        content: frame.content[page],
        skeletons: frame.skeletons,
      })),
    };
  };

  new MutationObserver(() => {
    probe.dirty = true;
    probe.lastChange = performance.now();
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });

  function onFrame(t) {
    if (probe.dirty) {
      probe.dirty = false;
      probe.frames.push({ t, ...snapshot() });
    }
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);
}
