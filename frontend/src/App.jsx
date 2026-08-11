import { MantineProvider } from '@mantine/core';
import { useEffect, useState } from 'react';
import Admin from './pages/Admin';
import Home from './pages/Home';
import './App.css';

function useRoutePath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  return path;
}

function App() {
  const path = useRoutePath();
  const isAdmin = path.startsWith('/admin') || path.startsWith('/ircengg');

  return (
    <MantineProvider defaultColorScheme="light">
      {isAdmin ? <Admin /> : <Home />}
    </MantineProvider>
  );
}

export default App;
