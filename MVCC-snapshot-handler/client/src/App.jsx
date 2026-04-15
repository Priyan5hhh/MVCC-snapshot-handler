import { useState } from 'react';

function App() {
  const [response, setResponse] = useState('');

  const checkServer = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/health');
      const data = await res.json();
      setResponse(JSON.stringify(data));
    } catch (error) {
      setResponse('Error: ' + error.message);
    }
  };

  return (
    <div>
      <h1>MVCC Todo App</h1>
      <button onClick={checkServer}>Check Server</button>
      <p>{response}</p>
    </div>
  );
}

export default App;