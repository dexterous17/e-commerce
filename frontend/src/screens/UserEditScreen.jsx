import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import FormContainer from "../components/FormContainer";
import Meta from "../components/Meta";

//actions
import { getUserDetails, updateUser } from "../actions/userActions";

//constants // ACTIONS
import { USER_UPDATE_RESET } from "../constants/userConstants";

function UserEditForm({ user, userId, dispatch }) {
  const [email, setEmail] = useState(user.email);
  const [isAdmin, setIsAdmin] = useState(Boolean(user.isAdmin));
  const [name, setName] = useState(user.name);

  const submitHandler = (e) => {
    e.preventDefault();
    dispatch(updateUser({ _id: userId, name, email, isAdmin }));
  };

  return (
    <Form onSubmit={submitHandler}>
      <Form.Group controlId="name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="email">
        <Form.Label>Email Address</Form.Label>
        <Form.Control
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="isadmin">
        <Form.Check
          type="checkbox"
          label="Is Admin?"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
      </Form.Group>

      <Button type="submit" variant="secondary">
        Update
      </Button>
    </Form>
  );
}

const UserEditScreen = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();

  const dispatch = useDispatch();

  const userDetails = useSelector((state) => state.userDetails);
  const { loading, error, user } = userDetails;

  const userUpdate = useSelector((state) => state.userUpdate);
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = userUpdate;

  useEffect(() => {
    if (successUpdate) {
      dispatch({ type: USER_UPDATE_RESET });
      navigate("/admin/userlist");
    }
  }, [successUpdate, dispatch, navigate]);

  useEffect(() => {
    if (!successUpdate && (!user?.name || user?._id !== userId)) {
      dispatch(getUserDetails(userId));
    }
  }, [dispatch, successUpdate, userId, user?.name, user?._id]);

  return (
    <>
      <Meta title="Tailored by Boutique - Edit User" />
      <Link to="/admin/userlist" className="btn btn-outline-secondary mb-3">
        Go Back to All Users
      </Link>
      <FormContainer>
        <h1>Edit User</h1>
        {loadingUpdate && <BunnyLoader />}
        {errorUpdate && <Message variant="danger">{errorUpdate}</Message>}
        {loading ? (
          <BunnyLoader />
        ) : error ? (
          <Message variant="danger">{error}</Message>
        ) : user?._id === userId ? (
          <UserEditForm
            key={user._id}
            user={user}
            userId={userId}
            dispatch={dispatch}
          />
        ) : (
          <BunnyLoader />
        )}
      </FormContainer>
    </>
  );
};

export default UserEditScreen;
