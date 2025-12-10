import { AlertCircleIcon, CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const SearchableDropdown = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="form-control" ref={dropdownRef}>
      <label className="label">
        <span className="label-text font-medium">{label}</span>
        {error && (
          <span className="label-text-alt text-error flex items-center gap-1">
            <AlertCircleIcon className="size-3" />
            {error}
          </span>
        )}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`input input-bordered w-full flex items-center justify-between ${
            error ? "input-error" : ""
          } ${!value ? "text-base-content/40" : ""}`}
        >
          <span className="truncate text-left flex-1">
            {value || placeholder}
          </span>
          <ChevronDownIcon
            className={`size-4 transition-transform flex-shrink-0 ml-2 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 flex flex-col">
            <div className="p-2 border-b border-base-300 sticky top-0 bg-base-100">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="input input-sm input-bordered w-full pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-base-200 flex items-center justify-between transition-colors ${
                      value === option ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span>{option}</span>
                    {value === option && <CheckIcon className="size-4" />}
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-base-content/40">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};