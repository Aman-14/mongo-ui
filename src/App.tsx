import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api";
import { ConnectedPage } from "./components/ConnectedPage";
import "react-folder-tree/dist/style.css";

function App() {
  const [uri, setUri] = useState("mongodb://localhost:27017");
  const [isConnected, setIsConnected] = useState(false);
  const [clientId, setClientId] = useState("");
  const [dbs, setDbs] = useState<string[]>([]);

  async function handleConnection() {
    const { id, dbs } = await invoke<{ id: string; dbs: string[] }>(
      "connect_db",
      {
        uri,
      },
    );
    setIsConnected(true);
    setClientId(id);
    setDbs(dbs);
  }

  return (
    <div className="bg-gray-custom">
      {isConnected ? (
        <ConnectedPage dbs={dbs} clientId={clientId} />
      ) : (
        <div className="min-h-screen flex items-center justify-center flex-col bg-gray-custom">
          <Input
            className="w-3/6 bg-gray-custom placeholder:text-gray-600 border-sky-600 mb-5 text-gray-300"
            placeholder="Paste a connection string"
            onChange={(e) => setUri(e.target.value)}
            value={uri}
          />
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleConnection}
          >
            Connect
          </Button>
          <Button
            onClick={async () => {
              const res = await invoke("get_saved_dbs");
              console.log(res);
            }}
          >
            Click me to get saved dbs
          </Button>

          <Button
            onClick={async () => {
              const res = await invoke("save_uri", {
                name: "local",
                uri: "mongodb://localhost:27017",
              });
              console.log(res);
            }}
          >
            Create db
          </Button>
        </div>
      )}
    </div>
  );
}

export default App;
