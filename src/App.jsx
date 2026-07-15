import { MantineProvider } from '@mantine/core';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <Home />
    </MantineProvider>
  );
}

export default App;
