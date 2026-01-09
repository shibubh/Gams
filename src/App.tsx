/**
 * Main App component - entry point for the design canvas application.
 */

import { Canvas } from './ui/components/Canvas';
import { Toolbar } from './ui/toolbar/Toolbar';
import { LeftSidebar } from './ui/panels/LeftSidebar';
import { RightSidebar } from './ui/panels/RightSidebar';
import { StatusBar } from './ui/panels/StatusBar';
import './App.css';

function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="main-container">
        <LeftSidebar />
        <div className="canvas-container">
          <Canvas />
        </div>
        <RightSidebar />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
