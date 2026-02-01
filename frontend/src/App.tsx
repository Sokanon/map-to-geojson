import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import ImageCanvas from './components/ImageCanvas';
import ImageUpload from './components/ImageUpload';
import Toolbar from './components/Toolbar';
import BuildingList from './components/BuildingList';
import ExportPanel from './components/ExportPanel';

function App() {
  const [configExpanded, setConfigExpanded] = useState(true);

  return (
    <div className="app">
      <header className="header">
        <h1>Smart Map Digitizer</h1>
        <span className="header-subtitle">Magic wand selection with OCR labeling</span>
      </header>

      <main className="main">
        <aside className="sidebar">
          <section className="sidebar-section">
            <h2>Image</h2>
            <ImageUpload />
          </section>

          <section className="sidebar-section collapsible">
            <button
              className="section-header-btn"
              onClick={() => setConfigExpanded(!configExpanded)}
            >
              <h2>Config</h2>
              <LuChevronDown
                className={`collapse-icon ${configExpanded ? 'expanded' : ''}`}
                size={14}
              />
            </button>
            <div className={`collapsible-content ${configExpanded ? 'expanded' : ''}`}>
              <Toolbar />
            </div>
          </section>

          <section className="sidebar-section sidebar-section-grow">
            <BuildingList />
          </section>

          <section className="sidebar-section">
            <ExportPanel />
          </section>
        </aside>

        <div className="workspace">
          <ImageCanvas />
        </div>
      </main>
    </div>
  );
}

export default App;
