import { MapPin } from "lucide-react";

export function CenterPin() {
  return (
    <div className="flex flex-col items-center">
      <MapPin className="size-10 fill-primary text-primary-foreground drop-shadow-lg" strokeWidth={1.5} />
      <span className="-mt-1 size-1.5 rounded-full bg-black/30 blur-[1px]" />
    </div>
  );
}
