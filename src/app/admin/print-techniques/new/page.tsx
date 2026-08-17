import { PrintTechniqueForm } from "@/components/PrintTechniqueForm";

export default function NewPrintTechniquePage() {
  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">New print technique</h1>
      <p className="text-muted mb-8">
        This will show up as an option on every product&apos;s print techniques.
      </p>
      <PrintTechniqueForm />
    </div>
  );
}
