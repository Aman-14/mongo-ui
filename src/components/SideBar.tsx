import { invoke } from "@tauri-apps/api";
import { ArrowDown, ArrowRight, Database, Table } from "lucide-react";
import { useState } from "react";
import FolderTree, {
  FolderTreeProps,
  IconProps,
  NodeData,
} from "react-folder-tree";

const DatabaseIcon = ({ onClick: defaultOnClick }: IconProps) => {
  return <Database size={18} onClick={defaultOnClick} />;
};

interface Props {
  dbs: string[];
  clientId: string;
  openEditor: (ob: { dbName: string; collectionName: string }) => void;
}

export function SideBar({ dbs, clientId, openEditor }: Props) {
  const initState: NodeData = {
    name: "databases",
    children: dbs.map((name) => ({ name, children: [], isOpen: false })),
    isOpen: false,
  };

  const [treeState, setTreeState] = useState(initState);

  const onNameClick: FolderTreeProps["onNameClick"] = async ({
    defaultOnClick,
    nodeData,
  }) => {
    defaultOnClick();
    if (nodeData.path.length === 1) {
      //TODO: Dont fetch if already there
      const dbNode = treeState["children"]![nodeData.path[0]];
      const collections = await invoke<string[]>("get_collection_names", {
        dbName: dbNode.name,
        clientId,
      });

      setTreeState((prevState) => {
        const updatedChildren = prevState.children!.map((child, index) => {
          if (index === nodeData.path[0]) {
            return {
              ...child,
              children: collections.map((name) => ({ name })),
            };
          }
          return child;
        });
        return {
          ...prevState,
          children: updatedChildren,
        };
      });

      return;
    }

    const dbNode = treeState["children"]![nodeData.path[0]];
    const collection = dbNode.children![nodeData.path[1]];
    openEditor({
      dbName: dbNode.name,
      collectionName: collection.name,
    });
  };

  return (
    <div className="h-screen overflow-y-scroll">
      <FolderTree
        data={treeState}
        showCheckbox={false}
        readOnly
        // onChange={() => null}
        onNameClick={onNameClick}
        iconComponents={{
          CaretDownIcon: ({ onClick }) => (
            <ArrowDown size={18} color="grey" onClick={onClick} />
          ),
          CaretRightIcon: ({ onClick }) => (
            <ArrowRight size={18} color="grey" onClick={onClick} />
          ),
          // toggle open and close
          FolderIcon: DatabaseIcon,
          FolderOpenIcon: DatabaseIcon,

          // open editor with this collection name
          FileIcon: ({ onClick }) => <Table onClick={onClick} size={18} />,

          DeleteIcon: () => null,
          EditIcon: () => null,
          OKIcon: () => null,
          CancelIcon: () => null,
        }}
      />
    </div>
  );
}
