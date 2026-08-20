import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Database,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import "./onboarding-tour.css";

const steps = [
  {
    icon: Sparkles,
    eyebrow: "BEM-VINDO AO EDUSYSTEM",
    title: "Sua gestão começa organizada",
    description:
      "Este guia apresenta a ordem recomendada para configurar a instituição e começar a trabalhar com dados reais.",
    items: [
      [ShieldCheck, "Conta protegida", "A senha é solicitada em toda abertura do aplicativo."],
      [Database, "Dados locais", "O SQLite é criado no computador e permanece fora do executável."],
    ],
  },
  {
    icon: School,
    eyebrow: "PASSO 1",
    title: "Configure a instituição",
    description:
      "Abra Configurações, escolha escola, creche, cursinho, faculdade ou universidade e defina os módulos que sua equipe utilizará.",
    items: [
      [School, "Cadastre a estrutura", "Crie escolas, turmas, matérias e cursos antes dos alunos."],
      [Users, "Monte a equipe", "O diretor cria usuários e define os vínculos e permissões de cada perfil."],
    ],
  },
  {
    icon: BookOpenCheck,
    eyebrow: "PASSO 2",
    title: "Comece a rotina pedagógica",
    description:
      "Cadastre ou importe alunos, lance notas por matéria e faça a chamada separada por turma e data.",
    items: [
      [Users, "Acompanhamento", "Registre comportamento, observações e evolução de cada estudante."],
      [BarChart3, "Relatórios", "Use gráficos e PDFs para reuniões, planejamento e comunicação com responsáveis."],
    ],
  },
  {
    icon: ShieldCheck,
    eyebrow: "PRONTO PARA COMEÇAR",
    title: "Cada usuário no seu espaço",
    description:
      "Contas, preferências e quadros pessoais ficam separados. Dados institucionais são compartilhados somente conforme as permissões do perfil.",
    items: [
      [Database, "Faça backups", "Copie periodicamente a pasta C:\\EduSystem\\dados com o aplicativo fechado."],
      [ShieldCheck, "Proteja os acessos", "Use uma conta individual por pessoa e nunca compartilhe senhas."],
    ],
  },
];

export default function OnboardingTour({ open, onClose }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight")
        setIndex((current) => Math.min(steps.length - 1, current + 1));
      if (event.key === "ArrowLeft")
        setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const step = steps[index];
  const Icon = step.icon;

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section
        className="glass-panel onboarding-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button
          className="onboarding-close"
          type="button"
          aria-label="Fechar apresentação"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <div className="onboarding-visual" aria-hidden="true">
          <span className="onboarding-icon"><Icon size={38} /></span>
          <div className="onboarding-orbit orbit-one" />
          <div className="onboarding-orbit orbit-two" />
        </div>
        <div className="onboarding-content">
          <p className="eyebrow">{step.eyebrow}</p>
          <h2 id="onboarding-title">{step.title}</h2>
          <p className="onboarding-description">{step.description}</p>
          <div className="onboarding-items">
            {step.items.map(([ItemIcon, title, text]) => (
              <article key={title}>
                <ItemIcon size={19} />
                <div><strong>{title}</strong><span>{text}</span></div>
              </article>
            ))}
          </div>
        </div>
        <footer className="onboarding-footer">
          <div className="onboarding-dots" aria-label={`Etapa ${index + 1} de ${steps.length}`}>
            {steps.map((item, dotIndex) => (
              <button
                type="button"
                key={item.title}
                className={dotIndex === index ? "active" : ""}
                aria-label={`Ir para etapa ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
          <div className="onboarding-actions">
            {index > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setIndex(index - 1)}>
                <ArrowLeft size={16} /> Voltar
              </button>
            ) : <span />}
            {index < steps.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setIndex(index + 1)}>
                Próximo <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Começar a usar
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
