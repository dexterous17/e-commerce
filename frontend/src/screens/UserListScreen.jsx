import { useEffect, useState } from "react";
import { Button, Table } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import ConfirmationModal from "../components/ConfirmationModal";
import Meta from "../components/Meta";

//actions
import { listUsers, deleteUser } from "../store/actions/userActions";

const UserListScreen = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const userList = useSelector((state) => state.userList);
  const { loading, error, users } = userList;

  const userLogin = useSelector((state) => state.userLogin);
  const { userInfo } = userLogin;

  const userDelete = useSelector((state) => state.userDelete);
  const { success: successDelete } = userDelete;

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listUsers());
    } else {
      navigate("/login");
    }
  }, [dispatch, navigate, userInfo, successDelete]);

  const deleteHandler = (id) => {
    dispatch(deleteUser(id));
  };

  //confirmation modal functionality
  const [show, setShow] = useState(false);
  const [modalItemId, setModalItemId] = useState({});

  const handleClose = () => setShow(false);
  const handleShow = (id) => {
    setModalItemId(id);
    setShow(true);
  };

  return (
    <>
      <Meta title="Tailored by Boutique - Users" />
      <h1>Users</h1>
      {loading ? (
        <BunnyLoader />
      ) : error ? (
        <Message variant="danger">{error}</Message>
      ) : (
        <>
          <Table striped bordered hover responsive className="table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>ADMIN</th>
                <th>EDIT</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="text-dark">
                  <td>{user._id}</td>
                  <td>{user.name}</td>
                  <td>
                    <a href={`mailto:${user.email}`} alt={user.email}>
                      {user.email}
                    </a>
                  </td>
                  <td>
                    {user.isAdmin ? (
                      <i
                        className="fas fa-check"
                        style={{ color: "green" }}
                      ></i>
                    ) : (
                      <i className="fas fa-times" style={{ color: "red" }}></i>
                    )}
                  </td>
                  <td className="d-flex justify-content-around">
                    <Button
                      as={Link}
                      to={`/admin/users/${user._id}/edit`}
                      variant="light"
                      className="btn-sm"
                    >
                      <i className="fas fa-edit"></i>
                    </Button>

                    <Button
                      variant="danger"
                      disabled={userInfo._id === user._id}
                      className="btn-sm"
                      onClick={() => {
                        handleShow(user._id);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ConfirmationModal
            show={show}
            onHide={handleClose}
            confirmHandler={deleteHandler}
            title="Deleting a User"
            body="Are you sure you want to delete this user?"
            cancelButton="Cancel"
            cancelButtonColor="primary"
            confirmButton="Delete User"
            confirmButtonColor="secondary"
            id={modalItemId}
          />
        </>
      )}
    </>
  );
};

export default UserListScreen;
