<?php

namespace App\Http\Requests\DepartmentOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLecturerRequest extends FormRequest
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
            'email'       => ['nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
        ];
    }
}
