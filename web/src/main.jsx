import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./theme-vars.css";
import "./styles.css";
import "./glass-system.css";

// HashRouter funciona tanto no servidor de desenvolvimento quanto dentro do
// executável, onde o frontend é carregado por file:// e não existe um servidor
// HTTP para resolver rotas como /alunos diretamente.
document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
