import React from 'react';
import {
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  FileCode2,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Lock,
  Play,
  Rocket,
  Save,
  Sparkles,
  SquareTerminal,
  Wand2,
} from 'lucide-react';
import heroArtwork from '../assets/hero.png';

interface LandingPageProps {
  isAuthenticated: boolean;
  onEnterApp: () => void;
  onOpenEditor: () => void;
  onShowAuth: () => void;
}

const featureBlocks = [
  {
    title: 'Project command center',
    description: 'Create, browse, and reopen projects from a focused dashboard built for course work and team builds.',
    icon: FolderKanban,
  },
  {
    title: 'Monaco code editor',
    description: 'Write TypeScript, JavaScript, Python, HTML, CSS, JSON, Markdown, and more with a real editor experience.',
    icon: Code2,
  },
  {
    title: 'Files and tabs',
    description: 'Open files from the explorer, switch between tabs, create new files, and save changes with Ctrl+S.',
    icon: FileCode2,
  },
  {
    title: 'Integrated terminal',
    description: 'Keep command output near your code with a workspace terminal panel that can be shown or hidden.',
    icon: SquareTerminal,
  },
  {
    title: 'AI assistant panel',
    description: 'Use the compact assistant beside the editor for explanations, debugging support, and coding guidance.',
    icon: Bot,
  },
  {
    title: 'Secure workspace',
    description: 'Authentication, session restore, protected APIs, and project ownership keep the workspace personal.',
    icon: Lock,
  },
];

const workflow = [
  { title: 'Sign in', detail: 'Create an account or restore your saved DewCode session.', icon: CheckCircle2 },
  { title: 'Create a project', detail: 'Choose a language and describe what you are building.', icon: LayoutDashboard },
  { title: 'Open the editor', detail: 'Edit files, save updates, use the terminal, and ask the AI assistant.', icon: Rocket },
];

const editorLines = [
  'const workspace = await dewcode.open(project);',
  'workspace.files.create("index.ts");',
  'workspace.ai.explain(activeSelection);',
  'await workspace.save({ shortcut: "Ctrl+S" });',
];

const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  onEnterApp,
  onOpenEditor,
  onShowAuth,
}) => {
  const primaryAction = isAuthenticated ? onOpenEditor : onShowAuth;

  return (
    <div className="min-h-screen overflow-x-hidden bg-dark text-slate-100">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-dark/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="DewCode home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Braces size={20} />
            </span>
            <span className="font-display text-xl font-bold tracking-normal">
              <span className="text-primary">Dew</span>Code
            </span>
          </button>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a className="transition hover:text-white" href="#features">Features</a>
            <a className="transition hover:text-white" href="#workflow">Workflow</a>
            <a className="transition hover:text-white" href="#stack">Stack</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAuthenticated ? onEnterApp : onShowAuth}
              className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              {isAuthenticated ? 'Dashboard' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={primaryAction}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-dark transition hover:bg-primary-dark"
            >
              <Play size={16} />
              Open Editor
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[92vh] overflow-hidden border-b border-white/10 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,212,184,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(244,114,182,0.14),transparent_26%),linear-gradient(135deg,#0A0A0F_0%,#12121A_48%,#071411_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-dark to-transparent" />

          <div className="relative mx-auto grid min-h-[calc(92vh-4rem)] max-w-7xl content-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
            <div className="max-w-3xl self-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase text-primary">
                <Sparkles size={14} />
                Full-stack code workspace
              </div>
              <h1 className="font-display text-5xl font-bold leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl">
                DewCode
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                A modern web IDE for creating projects, editing files, saving code, running terminal workflows, and getting help from an AI assistant in one focused workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={primaryAction}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-dark transition hover:bg-primary-dark"
                >
                  <Code2 size={18} />
                  {isAuthenticated ? 'Go to Code Editor' : 'Get Started'}
                </button>
                <button
                  type="button"
                  onClick={isAuthenticated ? onEnterApp : onShowAuth}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-primary/40 hover:bg-primary/10"
                >
                  Explore Workspace
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="mt-9 grid max-w-xl grid-cols-3 gap-3 text-sm">
                {[
                  ['8+', 'Languages'],
                  ['Ctrl+S', 'Quick save'],
                  ['AI', 'Coding help'],
                ].map(([value, label]) => (
                  <div key={label} className="border-l border-primary/35 pl-4">
                    <p className="font-display text-2xl font-bold text-white">{value}</p>
                    <p className="mt-1 text-xs uppercase text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[520px] lg:block">
              <div className="absolute right-0 top-1/2 w-[720px] -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-[#0D0D16] shadow-2xl shadow-black/40">
                <div className="flex h-11 items-center justify-between border-b border-white/10 bg-[#12121A] px-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-300" />
                    <span className="h-3 w-3 rounded-full bg-primary" />
                  </div>
                  <span className="text-xs text-slate-500">Editor Workspace</span>
                </div>
                <div className="grid h-[470px] grid-cols-[150px_1fr_190px]">
                  <div className="border-r border-white/10 bg-[#0A0A0F] p-3">
                    <p className="mb-3 text-[10px] uppercase text-slate-500">Explorer</p>
                    {['src', 'App.tsx', 'EditorPage.tsx', 'Terminal.tsx', 'api.ts'].map((item, index) => (
                      <div
                        key={item}
                        className={`mb-1 rounded px-2 py-1.5 text-xs ${index === 2 ? 'bg-primary/15 text-primary' : 'text-slate-400'}`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col bg-[#101018]">
                    <div className="flex border-b border-white/10">
                      {['EditorPage.tsx', 'Terminal.tsx'].map((tab, index) => (
                        <span
                          key={tab}
                          className={`border-r border-white/10 px-4 py-2 text-xs ${index === 0 ? 'border-b border-b-primary text-white' : 'text-slate-500'}`}
                        >
                          {tab}
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 p-5 font-mono text-sm leading-8">
                      {editorLines.map((line, index) => (
                        <p key={line} className="grid grid-cols-[32px_1fr] gap-3">
                          <span className="text-right text-slate-600">{index + 1}</span>
                          <span className="text-slate-200">{line}</span>
                        </p>
                      ))}
                    </div>
                    <div className="h-24 border-t border-white/10 bg-[#050508] p-3 text-xs text-slate-400">
                      <p className="text-primary">$ npm run dev</p>
                      <p className="mt-2">DewCode workspace ready on localhost</p>
                    </div>
                  </div>
                  <div className="border-l border-white/10 bg-[#0A0A0F] p-3">
                    <p className="mb-3 text-[10px] uppercase text-slate-500">AI Assistant</p>
                    <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-xs leading-5 text-slate-300">
                      Explain the active file, suggest fixes, and help plan your next code change.
                    </div>
                  </div>
                </div>
              </div>
              <img
                src={heroArtwork}
                alt=""
                className="absolute -bottom-2 left-4 h-44 w-auto opacity-80"
              />
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-white/10 bg-dark py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="mb-3 text-sm font-bold uppercase text-primary">Everything in one place</p>
              <h2 className="font-display text-3xl font-bold tracking-normal text-white sm:text-4xl">
                Built around the editor, not around clutter.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureBlocks.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-lg border border-white/10 bg-dark-800 p-5 transition hover:border-primary/40">
                    <Icon className="mb-4 text-primary" size={26} />
                    <h3 className="font-display text-lg font-bold tracking-normal text-white">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-white/10 bg-[#0D0D16] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.8fr_1fr] lg:px-8">
            <div>
              <p className="mb-3 text-sm font-bold uppercase text-primary">Introduction</p>
              <h2 className="font-display text-3xl font-bold tracking-normal text-white sm:text-4xl">
                From idea to editable project in minutes.
              </h2>
              <p className="mt-5 leading-7 text-slate-400">
                DewCode combines a React and Tailwind frontend with a Node.js TypeScript backend for authentication, projects, files, and workspace APIs.
              </p>
            </div>
            <div className="space-y-4">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-4 rounded-lg border border-white/10 bg-dark-800 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-dark">
                      <Icon size={21} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Step {index + 1}</p>
                      <h3 className="mt-1 font-display text-lg font-bold tracking-normal text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="stack" className="bg-dark py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'React + TypeScript', icon: Braces },
                { label: 'Tailwind CSS UI', icon: Wand2 },
                { label: 'Node.js API', icon: Database },
                { label: 'Project workflow', icon: GitBranch },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-dark-800 px-4 py-4">
                    <Icon className="text-primary" size={22} />
                    <span className="text-sm font-semibold text-slate-200">{item.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-lg border border-primary/20 bg-primary/10 p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-normal text-white">Ready to write code?</h2>
                <p className="mt-2 text-sm text-slate-400">Open the DewCode editor and continue inside your authenticated workspace.</p>
              </div>
              <button
                type="button"
                onClick={primaryAction}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-dark transition hover:bg-primary-dark"
              >
                <Save size={18} />
                Launch Editor
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
