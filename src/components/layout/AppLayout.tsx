import { useState } from "react";
import { Box, Fab, useMediaQuery, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileDrawer from "./MobileDrawer";
import { useNotifications } from "../../hooks/useNotifications";
import { MobileActionProvider } from "../../context/MobileActionContext";

export default function AppLayout() {
  const { unreadCount } = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <MobileActionProvider>
      <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar />
        {isMobile && (
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            ml: { xs: 0, md: "220px" },
            background: "linear-gradient(to right, #0f3eb5, #7795de 40%, #dce6f9)",
          }}
        >
          <TopBar unreadCount={unreadCount} />
          <Box
            sx={{
              flex: 1,
              backgroundColor: "#fff",
              borderTopLeftRadius: "32px",
              borderTopRightRadius: { xs: "32px", md: 0 },
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: "100%",
                overflowY: "auto",
                overflowX: "hidden",
                backgroundColor: "#fff",
                scrollbarGutter: "stable",
              }}
            >
              <Box sx={{ pb: { xs: "88px", md: 0 } }}>
                <Outlet />
              </Box>
            </Box>
          </Box>
        </Box>
        {isMobile && (
          <Fab
            color="primary"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={drawerOpen ? "close menu" : "open menu"}
            sx={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: theme.zIndex.fab,
            }}
          >
            {drawerOpen ? <CloseIcon /> : <MenuIcon />}
          </Fab>
        )}
      </Box>
    </MobileActionProvider>
  );
}
