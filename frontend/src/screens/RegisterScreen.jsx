import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Form, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

//components
import Message from "../components/Message";
import BunnyLoader from "../components/BunnyLoader";
import FormContainer from "../components/FormContainer";
import Meta from "../components/Meta";

//actions
import { register } from "../store/actions/userActions";

const RegisterScreen = () => {
  //component state that will hold the name, email and password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = useMemo(() => {
    const raw = searchParams.get("redirect") || "/";
    return raw.startsWith("/") ? raw : `/${raw}`;
  }, [searchParams]);

  const dispatch = useDispatch();

  const userRegister = useSelector((state) => state.userRegister);
  const { loading, error, userInfo } = userRegister;

  //if the user is already logged in, then apply a redirect so they do not see the login screen again
  //they would head directly to the shipping page if they are already logged in
  useEffect(() => {
    //if we are not logged in then userInfo will be null
    if (userInfo) {
      navigate(redirect, { replace: true });
    }
  }, [navigate, userInfo, redirect]);

  //handle submit button
  const submitHandler = (e) => {
    e.preventDefault();

    //check to see if the passwords match
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
    } else {
      //call action creater with name, email and password state that the user provided
      dispatch(register(name, email, password));
    }
  };

  return (
    <FormContainer>
      <Meta title="Tailored by Boutique - Register" />
      <h1>Sign Up</h1>
      {/* error message that pops up if the passwords do not match */}
      {message && <Message variant="danger">{message}</Message>}
      {/* check to see if the action is still loading or has an error  */}
      {error && <Message variant="danger">{error}</Message>}
      {loading && <BunnyLoader />}
      <Form onSubmit={submitHandler}>
        {/* name */}
        <Form.Group controlId="name" className="mb-3">
          <Form.Label>Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* email */}
        <Form.Group controlId="email" className="mb-3">
          <Form.Label>Email Address</Form.Label>
          <Form.Control
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* password */}
        <Form.Group controlId="password" className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* confirm password */}
        <Form.Group controlId="confirmPassword" className="mb-3">
          <Form.Label>Confirm Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          ></Form.Control>
        </Form.Group>

        {/* button */}
        <Button type="submit" variant="secondary">
          Register
        </Button>
      </Form>
      <div className="form-screen__footer">
        Already a Member?{" "}
        <Link
          to={
            redirect !== "/"
              ? `/login?redirect=${encodeURIComponent(redirect)}`
              : "/login"
          }
        >
          Sign In
        </Link>
      </div>
    </FormContainer>
  );
};

export default RegisterScreen;
