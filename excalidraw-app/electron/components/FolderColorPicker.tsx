import React, { useCallback } from "react";

import "./FolderColorPicker.scss";

const PRESET_COLORS = [
  { name: "Blue", value: "#4A90D9" },
  { name: "Purple", value: "#7B68EE" },
  { name: "Red", value: "#E74C3C" },
  { name: "Orange", value: "#F39C12" },
  { name: "Yellow", value: "#F1C40F" },
  { name: "Green", value: "#27AE60" },
  { name: "Teal", value: "#1ABC9C" },
  { name: "Pink", value: "#E91E8B" },
  { name: "Indigo", value: "#5C6BC0" },
  { name: "Gray", value: "#95A5A6" },
];

interface FolderColorPickerProps {
  currentColor: string | undefined;
  onColorChange: (color: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export const FolderColorPicker: React.FC<FolderColorPickerProps> = ({
  currentColor,
  onColorChange,
  onClose,
  position,
}) => {
  const handleColorClick = useCallback(
    (color: string) => {
      onColorChange(color);
      onClose();
    },
    [onColorChange, onClose],
  );

  const handleReset = useCallback(() => {
    onColorChange("");
    onClose();
  }, [onColorChange, onClose]);

  return (
    <>
      <div className="FolderColorPicker__overlay" onClick={onClose} />
      <div
        className="FolderColorPicker"
        style={{ top: position.y, left: position.x }}
      >
        <p className="FolderColorPicker__title">Folder Color</p>
        <div className="FolderColorPicker__grid">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              className={`FolderColorPicker__swatch${
                currentColor === color.value
                  ? " FolderColorPicker__swatch--active"
                  : ""
              }`}
              style={{ backgroundColor: color.value }}
              onClick={() => handleColorClick(color.value)}
              title={color.name}
              type="button"
              aria-label={`Set color to ${color.name}`}
            />
          ))}
        </div>
        <button
          className="FolderColorPicker__reset"
          onClick={handleReset}
          type="button"
        >
          Reset to default
        </button>
      </div>
    </>
  );
};

export default FolderColorPicker;
