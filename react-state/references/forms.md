# Forms: FormData, server actions, useActionState, Zod

For traditional submit-style forms, managing one `useState` + change handler per field is boilerplate that needs careful synchronization. Let the platform collect the data.

## FormData instead of per-field state

```tsx
// Avoid: a state variable and handler per field
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
// ...handlers for each

// Prefer: FormData captures every named field automatically
function handleSubmit(formData: FormData) {
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
}
```

Benefits: no manual state, works as a web standard (even without JS — progressive enhancement), handles file uploads naturally, trivial to add fields.

## Server actions (Next.js)

Define a server function and pass it straight to `<form action={...}>` — no separate API route.

```tsx
// actions.ts
'use server';
export async function submitForm(formData: FormData) {
  const name = formData.get('name'); // runs on the server; validate, persist, etc.
}
```

## useActionState for pending/result state

```tsx
const [state, submitAction, isPending] = useActionState(serverAction, initialState);
return (
  <form action={submitAction}>
    {/* isPending → loading UI; state → success/error payload */}
  </form>
);
```

## Zod for validation + types from one schema

Define the schema once; get runtime validation, coercion (string → number/date), field-level errors, and the TypeScript type for free.

```tsx
import { z } from 'zod';

export const travelFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  email: z.string().email('Invalid email address'),
  age: z.coerce.number().min(18, 'Must be 18 or older'),
});

// in the server action
const result = travelFormSchema.safeParse(Object.fromEntries(formData));
if (!result.success) {
  return { status: 'error', errors: result.error.flatten().fieldErrors };
}
const validData = result.data; // fully typed and validated
```

## FormData vs controlled useState — when to use which

Use **FormData + server actions** for: traditional forms with a submit button, server mutations, progressive enhancement, many fields, file uploads, Next.js App Router.

Use **controlled `useState`** for: real-time/interactive UIs, validation on every keystroke, complex inter-field logic, search/filter inputs, anything needing precise per-field control as the user types.
