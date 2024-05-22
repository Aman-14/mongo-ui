import Editor, { Monaco } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useRef, useState } from "react";
import { SideBar } from "./SideBar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "./ui/button";
import { customStringify } from "@/lib/utils";
import { executeScript } from "@/api";
import { Tabs } from "./Tabs";

interface Props {
  dbs: string[];
  clientId: string;
}

export function ConnectedPage({ dbs, clientId }: Props) {
  const monacoRef = useRef<Monaco>();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const [editorModels, setEditorModels] = useState<
    {
      model: editor.ITextModel;
      dbName: string;
    }[]
  >([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [outputEditorModels, setOutputEditorModels] = useState<
    {
      model: editor.ITextModel;
      editorId: string;
    }[]
  >([]);
  const outputMonacoRef = useRef<Monaco>();
  const outputEditorRef = useRef<editor.IStandaloneCodeEditor>();

  // useEffect(() => {
  //   console.log(
  //     "useEffect: editor models",
  //     editorModels.map((m) => m.model.id),
  //   );
  // }, [editorModels]);
  //
  // useEffect(() => {
  //   console.log("useEffect: selected model id", selectedModelId);
  // }, [selectedModelId]);

  function handleEditorDidMount(
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) {
    monacoRef.current = monaco;
    editorRef.current = editor;

    monaco.editor.onDidCreateModel((model) => {
      console.log("onDidCreateModel", model);
    });
    monaco.editor.onWillDisposeModel((model) => {
      console.log("onWillDisposeModel", model);
    });

    // @ts-ignore
    window.editor = editor;
    // @ts-ignore
    window.monaco = monaco;
  }

  function handleEditorWillMount(monaco: Monaco) {
    const libSource = `
      interface Collection {
        find(): string[]
      }

      declare class db {
          static getCollection(name: string): Collection
      };
    `;
    const libUri = "ts:filename/index.d.ts";
    console.log("Trying to add model");
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      libSource,
      libUri,
    );
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      lib: ["nodenext"],
    });

    // When resolving definitions and references, the editor will try to use created models.
    // Creating a model for the library allows "peek definition/references" commands to work with the library.
    monaco.editor.createModel(
      libSource,
      "typescript",
      monaco.Uri.parse(libUri),
    );

    console.log("beforeMount: the monaco instance:", monaco);
  }

  function createEditorModal({
    dbName,
    collectionName,
  }: {
    dbName: string;
    collectionName: string;
  }) {
    const monaco = monacoRef.current!;
    console.log(monaco.editor.getEditors());

    const model = monaco.editor.createModel(
      `db.getCollection("${collectionName}").find({})`,
      "javascript",
    );
    setEditorModels((prev) => [
      ...prev,
      {
        model,
        dbName,
      },
    ]);
    setSelectedModelId(model.id);
    editorRef.current!.setModel(model);
    outputEditorRef.current!.setModel(null);
  }

  return (
    <div className="flex text-white">
      <div className="w-1/5 ">
        <SideBar dbs={dbs} clientId={clientId} openEditor={createEditorModal} />
      </div>
      <div className="w-4/5">
        {selectedModelId ? (
          <>
            <Button
              onClick={async () => {
                console.log("selectedmodelid", selectedModelId);
                console.log(
                  "$$$$",
                  editorModels.find((m) => {
                    return m.model.id === selectedModelId;
                  })!,
                );
                const { dbName, model: selectedModel } = editorModels.find(
                  (m) => {
                    return m.model.id === selectedModelId;
                  },
                )!;
                const bsonData = await executeScript({
                  script: selectedModel.getValue(),
                  clientId,
                  dbName,
                });
                const value = customStringify(bsonData);
                console.log(value);

                let outputModelEntry = outputEditorModels.find((m) => {
                  m.editorId === selectedModel.id;
                });
                if (!outputModelEntry) {
                  console.log("Creating ouput editor");
                  const model = monacoRef.current?.editor.createModel(
                    value,
                    "json",
                  )!;
                  outputModelEntry = {
                    model,
                    editorId: selectedModel.id,
                  };
                  setOutputEditorModels((prev) => [...prev, outputModelEntry!]);
                } else {
                  outputModelEntry.model.setValue(value);
                }
                outputEditorRef.current?.setModel(outputModelEntry.model);
              }}
            >
              Run
            </Button>
            <Tabs
              labels={editorModels.map((m) => ({
                id: m.model.id,
                name: m.dbName,
                selected: m.model.id === selectedModelId,
              }))}
              onSelect={(id: string) => {
                const modelEntry = editorModels.find((m) => {
                  return m.model.id === id;
                })!;
                setSelectedModelId(modelEntry.model.id);
                editorRef.current!.setModel(modelEntry.model);

                const outputModel = outputEditorModels.find((m) => {
                  return m.editorId === modelEntry.model.id;
                });
                if (!outputModel) {
                  outputEditorRef.current!.setModel(null);
                  return;
                }
                outputEditorRef.current!.setModel(outputModel.model);
              }}
              onClose={(id: string) => {
                const { model } = editorModels.find((m) => {
                  return m.model.id === id;
                })!;

                const outputModel = outputEditorModels.find((m) => {
                  return m.editorId === id;
                });
                if (editorModels.length === 1) {
                  setSelectedModelId(null);
                  setEditorModels([]);
                  editorRef.current!.setModel(null);
                  setOutputEditorModels([]);
                  outputEditorRef.current!.setModel(null);
                  return;
                }

                const newEditorModels = editorModels.filter((m) => {
                  return m.model.id !== id;
                });
                const newOutputEditorModels = outputEditorModels.filter((m) => {
                  return m.editorId !== id;
                });
                setEditorModels(newEditorModels);
                setOutputEditorModels(newOutputEditorModels);

                if (selectedModelId === id) {
                  const modelToSelect = newEditorModels.at(-1)!.model;
                  setSelectedModelId(modelToSelect.id);
                  editorRef.current!.setModel(modelToSelect);

                  const outputModelToSelect = newOutputEditorModels.find(
                    (m) => {
                      return m.editorId === modelToSelect.id;
                    },
                  );
                  if (outputModelToSelect) {
                    outputEditorRef.current!.setModel(
                      outputModelToSelect.model,
                    );
                  } else {
                    outputEditorRef.current!.setModel(null);
                  }
                }

                model.dispose();
                outputModel?.model.dispose();
              }}
            />
          </>
        ) : null}

        <PanelGroup
          autoSaveId="example"
          direction="vertical"
          className="!h-full overflow-hidden"
          // className="!h-5/6"
        >
          <Panel collapsible={true} order={1}>
            <Editor
              // height="90vh"
              defaultLanguage="javascript"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                showUnused: false,
                folding: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                codeLens: false,
                contextmenu: false,
                model: null,
              }}
              onMount={handleEditorDidMount}
              beforeMount={handleEditorWillMount}
              //      onValidate={handleEditorValidation}
            />
          </Panel>
          <ResizeHandle />
          <Panel collapsible={false} defaultSize={50} order={2}>
            <Editor
              className="overflow-hidden"
              defaultLanguage="json"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                showUnused: false,
                folding: false,
                scrollBeyondLastLine: true,
                automaticLayout: true,
                codeLens: false,
                contextmenu: false,
                readOnly: true,
                model: null,
              }}
              onMount={(editor, monaco) => {
                outputMonacoRef.current = monaco;
                outputEditorRef.current = editor;

                // @ts-ignore
                window.outputEditor = editor;
              }}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default function ResizeHandle({
  id,
}: {
  className?: string;
  id?: string;
}) {
  return (
    <PanelResizeHandle className="ResizeHandleOuter" id={id}>
      <div className="ResizeHandleInner">
        <svg className="Icon" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M8,18H11V15H2V13H22V15H13V18H16L12,22L8,18M12,2L8,6H11V9H2V11H22V9H13V6H16L12,2Z"
          />
        </svg>
      </div>
    </PanelResizeHandle>
  );
}
