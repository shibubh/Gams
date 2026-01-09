/**
 * Main App component - entry point for the design canvas application.
 */

import { Canvas } from './ui/components/Canvas';
import { Toolbar } from './ui/toolbar/Toolbar';
import './App.css';

function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="canvas-container">
        <Canvas />
      </div>
    </div>
  );
}

export default App;
