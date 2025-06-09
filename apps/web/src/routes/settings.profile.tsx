import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/profile")({
  component: SettingsProfileComponent,
});

function SettingsProfileComponent() {
  return (
    <div className="p-2">
      <h3>Profile Settings</h3>
      <p>This is the profile settings page.</p>
      {/* Add profile form and other settings here */}
    </div>
  );
}
