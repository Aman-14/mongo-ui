import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Suspense, useEffect, useState } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api";
import { ConnectedPage } from "./components/ConnectedPage";
import "react-folder-tree/dist/style.css";
import { Database, Minus, Plus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ThemeProvider } from "@/components/ThemeProvider";

function App() {
  const [uri, setUri] = useState("mongodb://localhost:27017");
  const [isConnected, setIsConnected] = useState(false);
  const [clientId, setClientId] = useState("");
  const [dbs, setDbs] = useState<string[]>([]);
  const [showSaveInput, setShowsaveInput] = useState(false);
  const [connectionName, setConnectionName] = useState("");

  async function handleConnection() {
    if (showSaveInput && !connectionName) {
      throw new Error("Connection name is required");
    }
    try {
      const { id, dbs } = await invoke<{ id: string; dbs: string[] }>(
        "connect_db",
        {
          uri,
          name: connectionName,
        },
      );

      setIsConnected(true);
      setClientId(id);
      setDbs(dbs);
    } catch (err) {
      console.log(err);
    }
  }

  // return <Menu />;

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div>
        {isConnected ? (
          <ConnectedPage dbs={dbs} clientId={clientId} />
        ) : (
          <div className="min-h-screen flex justify-center items-center flex-col gap-3">
            <div className="w-3/6 flex justify-center items-center">
              <Input
                className="mr-3"
                placeholder="Paste a connection string"
                onChange={(e) => setUri(e.target.value)}
                value={uri}
              />
              {!showSaveInput && (
                <Plus
                  className="hover:cursor-pointer"
                  size={50}
                  // color="cyan"
                  onClick={() => {
                    setShowsaveInput(true);
                  }}
                />
              )}
              {showSaveInput && (
                <Minus
                  className="hover:cursor-pointer"
                  size={50}
                  // color="cyan"
                  onClick={() => {
                    setShowsaveInput(false);
                  }}
                />
              )}
            </div>
            {showSaveInput && (
              <Input
                className="w-25 mr-3"
                placeholder="Enter connection name"
                onChange={(e) => setConnectionName(e.target.value)}
                value={connectionName}
              />
            )}

            <Button
              // className="bg-green-700 hover:bg-green-800"
              onClick={handleConnection}
            >
              Connect {showSaveInput && "& Save"}
            </Button>
            <Suspense fallback={"Loading"}>
              <div className="w-3/6 mt-20">
                <h1 className="text-white text-lg mb-5">Saved Databases:</h1>
                <SavedDatabases
                  onConnect={(ob: { clientId: string; dbs: string[] }) => {
                    setIsConnected(true);
                    setDbs(ob.dbs);
                    setClientId(ob.clientId);
                  }}
                />
              </div>
            </Suspense>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

const SavedDatabases = ({
  onConnect,
}: {
  onConnect: (ob: { clientId: string; dbs: string[] }) => void;
}) => {
  const [dbs, setDbs] = useState<{ name: String; id: number }[]>([]);

  useEffect(() => {
    invoke("get_saved_dbs").then((d) => setDbs(d as []));
  }, []);

  async function connectDb(id: number) {
    console.log("Connecting");
    const { id: clientId, dbs } = await invoke<{
      id: string;
      dbs: string[];
    }>("connect_saved_db", {
      id,
    });
    console.log(clientId, dbs);
    onConnect({ clientId, dbs });
  }

  async function renameDb(id: number) {}
  async function deleteDb(id: number) {}

  return (
    <>
      {dbs.map((record, index) => (
        <ContextMenu key={index}>
          <ContextMenuTrigger className="flex items-center mb-2 text-white gap-10 justify-between pr-10 hover:bg-gray-900 p-2 rounded">
            <span className="text-lg flex items-center gap-2">
              <Database />
              {record.name}
            </span>
            <Button
              // className="bg-transparent border-green-700 hover:bg-green-700"
              size={"sm"}
              variant={"outline"}
              onClick={() => connectDb(record.id)}
            >
              Connect
            </Button>
          </ContextMenuTrigger>

          <ContextMenuContent className="">
            <ContextMenuItem onClick={() => renameDb(record.id)}>
              Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => deleteDb(record.id)}>
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </>
  );
};

export default App;
