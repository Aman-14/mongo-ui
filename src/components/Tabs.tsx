import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { useState } from "react";

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
        "top-0 mb-0 h-10 w-24 flex items-center justify-between border-t border-r border-l border-gray-500",
        selected ? "border-b border-b-yellow-500" : "",
      )}
      style={{
        backgroundColor,
      }}
      onMouseEnter={() => setShowCloseIcon(true)}
      onMouseLeave={() => setShowCloseIcon(false)}
    >
      <span className="ml-5">{label.name}</span>
      {showCloseIcon && (
        <XIcon
          size={18}
          className="mr-1"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            cursor: "pointer",
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
      )}
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
  return (
    <div className="flex">
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
