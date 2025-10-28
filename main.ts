const root = document.getElementById('root');
if (root) {
  const container = document.createElement('main');
  container.style.display = 'grid';
  container.style.placeItems = 'center';
  container.style.minHeight = '100dvh';
  container.innerHTML = '<h1>YadahCRM</h1><p>Production build is configured.</p>';
  root.appendChild(container);
}
