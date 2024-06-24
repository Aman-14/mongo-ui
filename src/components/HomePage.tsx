import { invoke } from "@tauri-apps/api";
import { Database, Minus, Plus } from "lucide-react";
import { Suspense, useEffect, useState, useContext } from "react";
import { Button } from "./ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Input } from "./ui/input";
import { LoadingContext } from "@/context/loading";
import { useToast } from "./ui/use-toast";

interface Props {
  onConnect: (ob: { clientId: string; dbs: string[] }) => void;
}

export function HomePage({ onConnect }: Props) {
  const [uri, setUri] = useState("mongodb://localhost:27017");
  const [showSaveInput, setShowsaveInput] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const setLoading = useContext(LoadingContext)!;
  const { toast } = useToast();

  async function handleConnection() {
    try {
      console.log("Tring to connect and save", { uri, connectionName });
      setLoading(true);
      const { id, dbs } = await invoke<{ id: string; dbs: string[] }>(
        "connect_db",
        {
          uri,
          name: connectionName,
        },
      );
      console.log("Connected and got id", id, dbs);
      onConnect({ clientId: id, dbs });
      setLoading(false);
    } catch (err) {
      toast({
        description: err as any,
        variant: "destructive",
        duration: 1000000000,
      });

      console.log(err);

      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex justify-center items-center flex-col gap-3">
      <div className="w-3/6 flex justify-center items-center">
        <Input
          className="mr-3"
          placeholder="Paste a connection string"
          onChange={(e) => setUri(e.target.value)}
          value={uri}
          autoCorrect="off"
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
          // autoCorrect="off"
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
          <SavedDatabases onConnect={onConnect} />
        </div>
      </Suspense>
    </div>
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
    console.log("Connecting a saved db");
    const { id: clientId, dbs } = await invoke<{
      id: string;
      dbs: string[];
    }>("connect_saved_db", {
      id,
    });
    console.log(clientId, dbs);
    onConnect({ clientId, dbs });
  }

  async function renameDb(_id: number) {}
  async function deleteDb(_id: number) {}

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
