<?php

namespace App\Http\Requests\CbtAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExamOfficerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file_number' => ['required', 'string', 'max:50', Rule::unique('users', 'file_number')],
            'name'        => ['required', 'string', 'max:255'],
            'email'       => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            // Schools are created by the Super Admin; the officer is scoped to one.
            'school_id'   => ['required', 'integer', Rule::exists('schools', 'id')],
            // Optional — the officer may be attached to a department now or later.
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $this->input('school_id'))],
        ];
    }
}
