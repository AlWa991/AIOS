export type Reversibility = "reversible" | "compensable" | "irreversible";

export type ActionRequest = {
  adapter: string;
  reversibility: Reversibility;
  payload: unknown;
};

export type ActionResult = {
  status: "completed" | "rejected";
  detail: string;
};

export interface Execution {
  request(a: ActionRequest): Promise<ActionResult>;
}
