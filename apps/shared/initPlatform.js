// Set platform class for scoped CSS and conditional logic
export default function setPlatformClass() {
  const isMobile = matchMedia('(max-width: 768px)').matches;
  document.documentElement.classList.toggle('is-mobile', isMobile);
  document.documentElement.classList.toggle('is-desktop', !isMobile);
}

setPlatformClass();
addEventListener('resize', () => setPlatformClass());
