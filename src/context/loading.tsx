import { createContext } from "react";

export const LoadingContext = createContext<React.Dispatch<
  React.SetStateAction<boolean>
> | null>(null);
