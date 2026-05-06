import { memo, useState } from "react";
import { Navbar, Nav, Container, NavDropdown } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useSelector, useDispatch } from "react-redux";

//actions
import { logout } from "../actions/userActions";

//components
import SearchBox from "./SearchBox";

//css
import "./Header.css";

const Header = () => {
  const [navExpanded, setNavExpanded] = useState(false);
  const userInfo = useSelector((state) => state.userLogin.userInfo);

  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header>
      <Navbar
        className="header__navbar"
        fixed="top"
        bg="primary"
        variant="dark"
        expand="xl"
        expanded={navExpanded}
        onToggle={(next) => setNavExpanded(next)}
        collapseOnSelect
      >
        {/* logo */}
        <Container fluid className="header__container px-2 px-sm-3">
          <LinkContainer to="/">
            <Navbar.Brand className="header__brand flex-shrink-0 py-0">
              <div className="header__logo">
                Tailored by <strong>Boutique</strong>
              </div>
            </Navbar.Brand>
          </LinkContainer>

          {/* side/collapsable links */}
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <div
            id="basic-navbar-nav"
            className={`collapse navbar-collapse${navExpanded ? " show" : ""}`}
          >
            <div className="header__collapse-inner">
              <div
                className="header__search-wrap flex-grow-1 my-2 my-xl-0"
                role="search"
                aria-label="Product search"
              >
                <SearchBox />
              </div>

              <div className="header__nav-cluster">
                <Nav
                  className="header__nav-links header__nav-links--shop"
                  navbar
                  aria-label="Store"
                >
                  <LinkContainer to="/products">
                    <Nav.Link>
                      <i className="fas fa-tshirt mr-1"></i>
                      <span className="header__nav-label">Browse Inventory</span>
                    </Nav.Link>
                  </LinkContainer>
                  <LinkContainer to="/cart">
                    <Nav.Link>
                      <i className="fas fa-shopping-cart mr-1"></i>
                      <span className="header__nav-label">Cart</span>
                    </Nav.Link>
                  </LinkContainer>
                </Nav>

                <Nav
                  className="header__nav-links header__nav-links--account"
                  navbar
                  aria-label="Account"
                >
                  {userInfo ? (
                    <NavDropdown
                      title={
                        <span>
                          <i className="fas fa-user mr-1"></i>{" "}
                          <span className="header__nav-label">{userInfo.name}</span>{" "}
                        </span>
                      }
                      id="username"
                    >
                      <LinkContainer to="/profile">
                        <NavDropdown.Item>Profile</NavDropdown.Item>
                      </LinkContainer>
                      <NavDropdown.Item onClick={handleLogout}>
                        Logout
                      </NavDropdown.Item>
                    </NavDropdown>
                  ) : (
                    <LinkContainer to="/login">
                      <Nav.Link>
                        <i className="fas fa-user mr-1"></i>
                        <span className="header__nav-label">Sign In</span>
                      </Nav.Link>
                    </LinkContainer>
                  )}
                  {userInfo && userInfo.isAdmin && (
                    <NavDropdown title="Admin" id="adminmenu">
                      <LinkContainer to="/admin/userlist">
                        <NavDropdown.Item>Users</NavDropdown.Item>
                      </LinkContainer>
                      <LinkContainer to="/admin/productlist">
                        <NavDropdown.Item>Products</NavDropdown.Item>
                      </LinkContainer>
                      <LinkContainer to="/admin/orderlist">
                        <NavDropdown.Item>Orders</NavDropdown.Item>
                      </LinkContainer>
                    </NavDropdown>
                  )}
                </Nav>
              </div>
            </div>
          </div>
        </Container>
      </Navbar>
    </header>
  );
};

export default memo(Header);
