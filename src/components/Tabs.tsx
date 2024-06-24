import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import "./Tabs.css";

interface ILabel {
  id: string;
  name: string;
  selected: boolean;
}

const Tab = ({
  label,
  onSelect,
  selected,
  onClose,
}: {
  label: ILabel;
  onSelect: () => void;
  onClose: () => void;
  selected: boolean;
}) => {
  const [showCloseIcon, setShowCloseIcon] = useState(false);
  const backgroundColor = selected ? "#110f1b" : undefined;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "top-0 mb-0 h-10 flex items-center justify-between border-t border-r border-l border-gray-500",
        selected ? "border-b border-b-yellow-500" : "",
      )}
      style={{
        backgroundColor,
      }}
      onMouseEnter={() => setShowCloseIcon(true)}
      onMouseLeave={() => setShowCloseIcon(false)}
    >
      <span className="m-3 mr-2">{label.name}</span>
      <XIcon
        size={18}
        className="mr-1"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          cursor: "pointer",
          visibility: showCloseIcon ? undefined : "hidden",
        }}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
    </button>
  );
};

export const Tabs = ({
  labels,
  onSelect,
  onClose,
}: {
  labels: ILabel[];
  onSelect: (labelId: string) => void;
  onClose: (labelId: string) => void;
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "w") {
        event.preventDefault();
        const selectedTab = labels.find((label) => label.selected);
        if (selectedTab) {
          onClose(selectedTab.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [labels, onClose]);

  return (
    <div className="flex overflow-x-auto whitespace-nowrap custom-scrollbar">
      {labels.map((label, index) => (
        <Tab
          key={index}
          label={label}
          onSelect={() => onSelect(label.id)}
          selected={label.selected}
          onClose={() => onClose(label.id)}
        />
      ))}
    </div>
  );
};
