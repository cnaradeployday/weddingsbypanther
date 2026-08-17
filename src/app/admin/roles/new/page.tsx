import { RoleForm } from "@/components/RoleForm";

export default function NewRolePage() {
  return (
    <div>
      <h1 className="font-serif text-3xl mb-1">New role</h1>
      <p className="text-muted mb-8">Pick which backoffice sections this role can read or edit.</p>
      <RoleForm />
    </div>
  );
}
