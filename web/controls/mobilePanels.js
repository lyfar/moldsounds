export function initMobilePanels({ ui }) {
  const { mobileToggleTowers, mobileToggleSettings, mobileBackdrop } = ui;

  const isMobileLayout = () =>
    window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 700px)").matches;

  const updateMobileToggleState = () => {
    const showTowers = document.body.classList.contains("mobile-show-towers");
    const showSettings = document.body.classList.contains("mobile-show-settings");
    if (mobileToggleTowers) {
      mobileToggleTowers.setAttribute("aria-pressed", String(showTowers));
    }
    if (mobileToggleSettings) {
      mobileToggleSettings.setAttribute("aria-pressed", String(showSettings));
    }
  };

  const closeMobilePanels = () => {
    document.body.classList.remove("mobile-show-towers", "mobile-show-settings", "mobile-panel-open");
    updateMobileToggleState();
  };

  const openMobilePanel = (panel) => {
    if (!isMobileLayout()) {
      return;
    }
    document.body.classList.remove("mobile-show-towers", "mobile-show-settings");
    if (panel === "towers") {
      document.body.classList.add("mobile-show-towers");
    } else if (panel === "settings") {
      document.body.classList.add("mobile-show-settings");
    }
    document.body.classList.add("mobile-panel-open");
    updateMobileToggleState();
  };

  if (mobileToggleTowers) {
    mobileToggleTowers.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("mobile-show-towers");
      if (isOpen) {
        closeMobilePanels();
      } else {
        openMobilePanel("towers");
      }
    });
  }

  if (mobileToggleSettings) {
    mobileToggleSettings.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("mobile-show-settings");
      if (isOpen) {
        closeMobilePanels();
      } else {
        openMobilePanel("settings");
      }
    });
  }

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener("click", () => {
      closeMobilePanels();
    });
  }

  updateMobileToggleState();

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      closeMobilePanels();
    }
  });
}
