import { useState } from "react";
import "./App.css";
import { ConnectedPage } from "./components/ConnectedPage";
import "react-folder-tree/dist/style.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { HomePage } from "./components/HomePage";
import { LoadingContext } from "./context/loading";
import { Toaster } from "./components/ui/toaster";

function App() {
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [dbs, setDbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function onConnect({
    clientId,
    dbs,
  }: {
    clientId: string;
    dbs: string[];
  }) {
    setClientId(clientId);
    setDbs(dbs);
  }

  return (
    <LoadingContext.Provider value={setLoading}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className={loading ? "blur-sm pointer-events-none" : ""}>
          {clientId ? (
            <ConnectedPage dbs={dbs} clientId={clientId} />
          ) : (
            <HomePage onConnect={onConnect} />
          )}
          <Toaster />
        </div>
      </ThemeProvider>
    </LoadingContext.Provider>
  );
}

export default App;
