const root = document.getElementById('root');
const bars = document.getElementById('bars');
const sidebar = document.getElementById('sidebar')

bars.onclick = () => {
  root.classList.toggle('active');
  sidebar.classList.toggle('active');
}
