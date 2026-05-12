import { Box } from "@mui/material";
import CreateOrgForm from "../components/organizations/CreateOrgForm";

export default function CreateOrgPage() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <CreateOrgForm />
    </Box>
  );
}
