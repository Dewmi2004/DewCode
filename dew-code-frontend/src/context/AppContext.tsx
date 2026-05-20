import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Project, FileNode } from '../types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  projects: Project[];
  setProjects: (p: Project[]) => void;
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
  openFiles: FileNode[];
  setOpenFiles: (f: FileNode[]) => void;
  activeFile: FileNode | null;
  setActiveFile: (f: FileNode | null) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

const DEMO_USER: User = {
  id: '1',
  name: 'demo',
  email: 'demo@dewcode.dev',
  role: 'Admin',
};

const DEMO_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform',
    description: 'Full-stack online store with payment integration',
    language: 'JavaScript',
    lastModified: '2024-01-20',
    status: 'Active',
    files: [
      { id: 'src', name: 'src', type: 'folder', path: 'src', children: [
        { id: 'components', name: 'components', type: 'folder', path: 'src/components', children: [
          { id: 'header', name: 'Header.jsx', type: 'file', path: 'src/components/Header.jsx', language: 'javascript',
            content: `import React from "react";\n\nconst Header = () => {\n  return <header>Header</header>;\n};\n\nexport default Header;` },
          { id: 'footer', name: 'Footer.jsx', type: 'file', path: 'src/components/Footer.jsx', language: 'javascript',
            content: `import React from "react";\n\nconst Footer = () => {\n  return <footer>Footer</footer>;\n};\n\nexport default Footer;` },
        ]},
        { id: 'app', name: 'App.js', type: 'file', path: 'src/App.js', language: 'javascript',
          content: `import React from 'react';\nimport Header from './components/Header';\nimport Footer from './components/Footer';\n\nfunction App() {\n  return (\n    <div className="App">\n      <Header />\n      <main>Content goes here</main>\n      <Footer />\n    </div>\n  );\n}\n\nexport default App;` },
        { id: 'index', name: 'index.js', type: 'file', path: 'src/index.js', language: 'javascript',
          content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<App />);` },
      ]},
      { id: 'pkg', name: 'package.json', type: 'file', path: 'package.json', language: 'json',
        content: `{\n  "name": "ecommerce-platform",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0",\n    "react-dom": "^18.0.0"\n  }\n}` },
      { id: 'readme', name: 'README.md', type: 'file', path: 'README.md', language: 'markdown',
        content: `# E-commerce Platform\n\nFull-stack online store with payment integration.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`` },
    ],
  },
  {
    id: '2',
    name: 'AI Chatbot',
    description: 'Intelligent conversational AI assistant',
    language: 'Python',
    lastModified: '2024-01-22',
    status: 'Active',
    files: [
      { id: 'main', name: 'main.py', type: 'file', path: 'main.py', language: 'python',
        content: `from fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Message(BaseModel):\n    content: str\n\n@app.post("/chat")\nasync def chat(message: Message):\n    return {"response": f"Echo: {message.content}"}` },
      { id: 'req', name: 'requirements.txt', type: 'file', path: 'requirements.txt', language: 'plaintext',
        content: `fastapi==0.104.0\nuvicorn==0.24.0\npydantic==2.4.0` },
    ],
  },
  {
    id: '3',
    name: 'Portfolio Website',
    description: 'Personal portfolio with animations',
    language: 'React',
    lastModified: '2024-01-19',
    status: 'Active',
    files: [
      { id: 'index-html', name: 'index.html', type: 'file', path: 'index.html', language: 'html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Portfolio</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>` },
    ],
  },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);

  const login = (email: string, _password: string): boolean => {
    if (email === 'demo@dewcode.dev' || email === 'demo') {
      setUser(DEMO_USER);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setActiveProject(null);
    setOpenFiles([]);
    setActiveFile(null);
  };

  return (
    <AppContext.Provider value={{
      user, setUser, isAuthenticated: !!user,
      projects, setProjects,
      activeProject, setActiveProject,
      openFiles, setOpenFiles,
      activeFile, setActiveFile,
      login, logout,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
