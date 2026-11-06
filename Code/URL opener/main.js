function openInPage() {
  const url = document.getElementById("url").value;
  document.getElementById("viewer").src = url;
}

function openNewTab() {
  const url = document.getElementById("url").value;
  window.open(url, "_blank");
}

function toggleDark() {
  document.body.classList.toggle("dark");
}
