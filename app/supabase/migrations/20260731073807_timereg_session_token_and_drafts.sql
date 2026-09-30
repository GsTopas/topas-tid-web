-- Vedvarende login: token i URL saa genstart ikke logger folk ud
ALTER TABLE timereg.employees ADD COLUMN session_token TEXT;

-- Kladde-autosave af dagformularen: overlever genstarter og doede sessioner
CREATE TABLE timereg.form_drafts (
    employee_id INT NOT NULL REFERENCES timereg.employees(id),
    work_date   DATE NOT NULL,
    payload     JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_id, work_date)
);
