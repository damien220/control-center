import { AccessGate } from "@/components/access-gate";
import { ControlCenter } from "@/components/control-center";

export default function Home() {
  return (
    <AccessGate>
      <ControlCenter />
    </AccessGate>
  );
}
